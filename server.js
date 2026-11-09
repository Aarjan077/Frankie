/**
 * FRANKIE — small self-hosted photography backend; no external npm modules.
 * Requires Node.js 22+. Cloudflare R2 is required for durable admin uploads in production.
 * The admin / 1234 account is a LOCAL DEMONSTRATION ONLY.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const META_FILE = path.join(DATA_DIR, 'photos.json');
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PROD ? '' : '1234');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SESSION_LIFE = 8 * 60 * 60 * 1000;
const sessions = new Map();
const rateLimits = new Map();
const privateStore = require('./private-storage')(DATA_DIR, ROOT, readPhotos);
const paymentApi = require('./payment-api')({
  DATA_DIR, IS_PROD, send, validOrigin, readBody, readPhotos, privateStore
});

if (IS_PROD && (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD === '1234')) {
  console.error('PRODUCTION BLOCKED: Set a strong ADMIN_PASSWORD (minimum 12 characters).');
  process.exit(1);
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid PORT');
fs.mkdirSync(UPLOAD_DIR, { recursive:true });
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, '[]\n', { flag:'wx' });
const passwordSalt = crypto.randomBytes(16);
const passwordHash = crypto.scryptSync(ADMIN_PASSWORD, passwordSalt, 64);

function readPhotos() {
  const photos = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  if (!Array.isArray(photos)) throw new Error('Invalid photo metadata');
  return photos;
}
function savePhotos(photos) {
  const temp = `${META_FILE}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(photos, null, 2) + '\n', { flag:'wx', mode:0o600 });
  fs.renameSync(temp, META_FILE);
}
function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers });
  res.end(body);
}
function parseCookies(req) {
  const result = {};
  for (const pair of (req.headers.cookie || '').split(';')) {
    const index = pair.indexOf('=');
    if (index > 0) result[pair.slice(0,index).trim()] = pair.slice(index+1).trim();
  }
  return result;
}
function getSession(req) {
  const id = parseCookies(req).frankie_sid;
  if (!id || !sessions.has(id)) return null;
  const session = sessions.get(id);
  if (session.expires < Date.now()) { sessions.delete(id); return null; }
  return session;
}
function secureCookie(req) {
  return (req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
}
function validOrigin(req) {
  // Modern browsers send Origin on state-changing fetches. Same-origin only.
  const origin = req.headers.origin;
  if (!origin) return false;
  try { const parsed = new URL(origin); return parsed.host === req.headers.host && (parsed.protocol === 'https:' || parsed.protocol === 'http:'); }
  catch { return false; }
}
function authorisedWrite(req, res) {
  const session = getSession(req);
  if (!session) { send(res, 401, { error:'Please sign in again.' }); return false; }
  if (!validOrigin(req) || req.headers['x-csrf-token'] !== session.csrf) {
    send(res, 403, { error:'Security check failed. Refresh the admin page.' }); return false;
  }
  return true;
}
async function readBody(req, maximum) {
  const advertised = Number(req.headers['content-length'] || 0);
  if (advertised > maximum) throw Object.assign(new Error('File or request is too large.'), { status:413 });
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maximum) throw Object.assign(new Error('File or request is too large.'), { status:413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function detectImage(buffer) {
  if (buffer.length < 16) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext:'jpg', type:'image/jpeg' };
  if (buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext:'png', type:'image/png' };
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return { ext:'webp', type:'image/webp' };
  return null;
}
function attemptLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip) || { first:now, count:0 };
  if (now - record.first > 15 * 60 * 1000) { record.first = now; record.count = 0; }
  record.count++;
  rateLimits.set(ip, record);
  return record.count <= 5;
}
const STATIC_MIMES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.mp3':'audio/mpeg' };
function sendFile(req, res, filepath, contentType, cacheControl = 'public, max-age=300') {
  fs.stat(filepath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const stream = fs.createReadStream(filepath);
    res.writeHead(200, { 'Content-Type':contentType, 'Content-Length':stat.size, 'Cache-Control':cacheControl });
    if (req.method === 'HEAD') { stream.destroy(); res.end(); return; }
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const name = url.pathname;
    if (name === '/api/health' && req.method === 'GET') return send(res, 200, { online:true, uploadLimitMB:10 });
    if (await paymentApi.handle(req, res, name, url)) return;

    if (name === '/api/photos' && req.method === 'GET') {
      const photos = readPhotos().map(({ id, title, file, createdAt }) => ({ id, title, url:`/uploads/${file}`, createdAt }));
      return send(res, 200, photos);
    }
    if (name === '/api/admin/session' && req.method === 'GET') {
      const session = getSession(req);
      return send(res, 200, { authenticated:!!session, username:session ? ADMIN_USERNAME : null, csrf:session ? session.csrf : null });
    }
    if (name === '/api/admin/login' && req.method === 'POST') {
      if (!validOrigin(req)) return send(res, 403, { error:'Requests must come from this website.' });
      const ip = req.socket.remoteAddress || 'unknown';
      if (!attemptLimit(ip)) return send(res, 429, { error:'Too many attempts. Try again after 15 minutes.' });
      const body = JSON.parse((await readBody(req, 4096)).toString('utf8'));
      const username = typeof body.username === 'string' ? body.username : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length > 512 || username.length > 128) return send(res, 401, { error:'Incorrect username or password.' });
      const comparison = crypto.scryptSync(password, passwordSalt, 64);
      if (username !== ADMIN_USERNAME || !crypto.timingSafeEqual(comparison, passwordHash)) {
        return send(res, 401, { error:'Incorrect username or password.' });
      }
      // Successful login resets this IP's temporary login limit.
      rateLimits.delete(ip);
      const sid = crypto.randomBytes(32).toString('hex');
      const csrf = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, { expires:Date.now()+SESSION_LIFE, csrf });
      res.setHeader('Set-Cookie', `frankie_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secureCookie(req)}`);
      return send(res, 200, { authenticated:true, username:ADMIN_USERNAME, csrf });
    }
    if (name === '/api/admin/logout' && req.method === 'POST') {
      if (!authorisedWrite(req,res)) return;
      const sid = parseCookies(req).frankie_sid;
      sessions.delete(sid);
      res.setHeader('Set-Cookie', `frankie_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(req)}`);
      return send(res, 200, { success:true });
    }
    if (name === '/api/admin/photos' && req.method === 'POST') {
      if (!authorisedWrite(req,res)) return;
      let title;
      try { title = decodeURIComponent(String(req.headers['x-photo-title'] || '')).trim().normalize('NFC'); }
      catch { return send(res, 400, { error:'Invalid photograph title.' }); }
      if (title.length < 2 || title.length > 80 || /[\x00-\x1f\x7f]/.test(title)) return send(res, 400, { error:'Use a title between 2 and 80 characters.' });
      const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
      if (!['image/jpeg','image/png','image/webp'].includes(contentType)) return send(res, 415, { error:'Choose a JPG, PNG or WebP photograph.' });
      const buffer = await readBody(req, MAX_IMAGE_BYTES);
      const kind = detectImage(buffer);
      if (!kind || kind.type !== contentType) return send(res, 415, { error:'The file is not a valid supported image format.' });
      const id = crypto.randomUUID();
      const file = `${id}.${kind.ext}`;
      // Save a durable copy of the public preview when R2 is configured.
      if (privateStore.configured) await privateStore.putPreview(file,buffer,contentType);
      fs.writeFileSync(path.join(UPLOAD_DIR, file), buffer, { flag:'wx', mode:0o644 });
      try {
        const photos = readPhotos();
        const item = { id, file, title, createdAt:new Date().toISOString() };
        photos.push(item);
        if (privateStore.configured) await privateStore.saveGallery(photos);
        savePhotos(photos);
        return send(res, 201, { id, title, url:`/uploads/${file}`, createdAt:item.createdAt });
      } catch(error) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR,file)); } catch { /* nothing */ }
        throw error;
      }
    }
    if (name === '/api/admin/photos' && req.method === 'GET') {
      if (!getSession(req)) return send(res, 401, { error:'Please sign in.' });
      return send(res, 200, readPhotos().map(({ id, title, file, createdAt }) => ({ id, title, url:`/uploads/${file}`, createdAt })));
    }
    const deleteMatch = name.match(/^\/api\/admin\/photos\/([0-9a-f-]{36})$/);
    if (deleteMatch && req.method === 'DELETE') {
      if (!authorisedWrite(req,res)) return;
      const id = deleteMatch[1];
      const photos = readPhotos();
      const item = photos.find(p => p.id === id);
      if (!item) return send(res, 404, { error:'Photograph not found.' });
      const remaining=photos.filter(p=>p.id!==id);
      if(privateStore.configured) {
        // Archive bytes before publishing removal, preserving existing buyers' access.
        await privateStore.archivePreview(item.file);
        await privateStore.saveGallery(remaining);
      }
      savePhotos(remaining);
      // Remove public thumbnail after the archived copy and gallery metadata are saved.
      if(privateStore.configured) await privateStore.deletePreview(item.file);
      if (privateStore.configured) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR,item.file)); } catch(error){if(error.code!=='ENOENT')console.error('Uploaded image cleanup:',error.message);}
      }
      // In sandbox local mode, keep uploaded bytes available for existing paid orders.
      // Public /uploads URLs below only serve photographs still in the active gallery.
      return send(res, 200, { success:true });
    }
    const uploadMatch = name.match(/^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/);
    if (uploadMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const filename = uploadMatch[1];
      if(!readPhotos().some(photo=>photo.file===filename))return send(res,404,{error:'Photograph not found.'});
      const type = STATIC_MIMES[path.extname(filename)];
      if(privateStore.configured){
        const preview=await privateStore.getPreview(filename);
        if(preview){
          res.writeHead(200,{'Content-Type':preview.contentType,'Content-Length':preview.bytes.length,'Cache-Control':'public, max-age=86400'});
          if(req.method==='HEAD')return res.end();
          return res.end(preview.bytes);
        }
      }
      return sendFile(req, res, path.join(UPLOAD_DIR,filename), type, 'public, max-age=86400');
    }
    if (name.startsWith('/api/') || name.startsWith('/uploads/')) return send(res, 404, { error:'Not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error:'Method not allowed.' });
    const sitePath = name === '/' ? '/index.html' : name;
    const relative = decodeURIComponent(sitePath).replace(/^\/+/, '');
    if (relative.startsWith('.') || relative.includes('..') || relative.split('/').some(s => s.startsWith('.'))) return send(res, 404, { error:'Not found.' });
    const filepath = path.resolve(ROOT, relative);
    const extension = path.extname(filepath).toLowerCase();
    // Explicitly allow ONLY public website files. Never expose backend source,
    // configuration, databases, logs, README or anything in data/.
    const publicStatic = new Set([
      'index.html','style.css','script.js','admin.html','admin.css','admin.js',
      'payment-result.html','payment-result.js',
      'frankie-portrait.jpg','background-music.mp3'
    ]);
    const isSitePhoto = /^(?:gallery-\d+|featured-\d+|about-\d+)\.(?:jpg|jpeg|png|webp)$/i.test(relative);
    if (!filepath.startsWith(ROOT + path.sep) || !STATIC_MIMES[extension] || !(publicStatic.has(relative) || isSitePhoto)) {
      return send(res, 404, { error:'Not found.' });
    }
    return sendFile(req, res, filepath, STATIC_MIMES[extension], extension === '.html' ? 'no-store' : 'public, max-age=300');
  } catch (error) {
    if (error.status && error.status < 500) return send(res, error.status, { error:error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error:'Invalid request.' });
    console.error('Request error:', error);
    return send(res, 500, { error:'Something went wrong. Please try again.' });
  }
});
async function startServer(){
  if(privateStore.configured){
    // Recover gallery metadata from R2 after a Render restart or redeploy.
    // R2 is authoritative; the local file is only a runtime cache.
    const saved=await privateStore.loadGallery();
    if(saved){
      const temp=`${META_FILE}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temp,JSON.stringify(saved,null,2)+'\n');
      fs.renameSync(temp,META_FILE);
    }else{
      const local=readPhotos();
      await privateStore.saveGallery(local);
    }
  }
  server.listen(PORT, () => {
    console.log(`Frankie website + backend running at http://localhost:${PORT}`);
    console.log(`Gallery storage: ${privateStore.configured?'R2 durable cloud storage':'LOCAL TEMPORARY disk, do not sell files on this setup'}`);
    if (!IS_PROD) console.warn('DEVELOPMENT MODE ONLY: Demo credentials admin / 1234 if no ADMIN_PASSWORD is set. Never deploy them.');
  });
}
startServer().catch(error=>{console.error('Cannot initialise durable gallery storage:',error);process.exit(1);});
