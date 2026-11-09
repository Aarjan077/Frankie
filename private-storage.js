/**
 * Private customer originals and durable gallery data.
 * Cloudflare R2 (private bucket), compatible with S3.
 * Local fallback exists ONLY for Stripe sandbox and developer testing.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const VALID_ID = /^(?:original-(?:10|[1-9])|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

module.exports = function createPrivateStorage(dataDir) {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET || '').trim();
  const configured = Boolean(accountId && accessKeyId && secretAccessKey && bucket);
  const localFolder = path.join(dataDir, 'private-originals');
  let client, commands;
  if (configured) {
    commands = require('@aws-sdk/client-s3');
    client = new commands.S3Client({
      region:'auto', endpoint:`https://${accountId}.r2.cloudflarestorage.com`,
      credentials:{accessKeyId,secretAccessKey}, forcePathStyle:true,
      maxAttempts:2
    });
  } else fs.mkdirSync(localFolder,{recursive:true});

  function idOk(id) { return typeof id === 'string' && VALID_ID.test(id); }
  function ensureId(id) { if (!idOk(id)) throw Object.assign(new Error('Invalid photo ID.'),{status:400}); }
  function objectKey(id) { ensureId(id); return `private-originals/${id}`; }
  function missing(error) { return error?.name === 'NotFound' || error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404; }
  async function putObject(Key, Body, ContentType='application/octet-stream') {
    if (!configured) throw new Error('Private cloud storage is not configured.');
    await client.send(new commands.PutObjectCommand({Bucket:bucket,Key,Body,ContentType}));
  }
  async function getObject(Key) {
    if (!configured) throw new Error('Private cloud storage is not configured.');
    try { return await client.send(new commands.GetObjectCommand({Bucket:bucket,Key})); }
    catch (error) { if(missing(error)) return null; throw error; }
  }
  async function deleteObject(Key) {
    if (!configured) return;
    await client.send(new commands.DeleteObjectCommand({Bucket:bucket,Key}));
  }
  async function streamToBuffer(body,max=20*1024*1024) {
    if (!body) return Buffer.alloc(0);
    if (typeof body.transformToByteArray === 'function') {
      const bytes=Buffer.from(await body.transformToByteArray());
      if(bytes.length>max) throw new Error('Storage object is too large.');
      return bytes;
    }
    const buffers=[]; let bytes=0;
    for await(const chunk of body) { const b=Buffer.from(chunk);bytes+=b.length;if(bytes>max)throw new Error('Storage object is too large.');buffers.push(b); }
    return Buffer.concat(buffers);
  }

  async function putMaster(id,content,type) {
    ensureId(id);
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw Object.assign(new Error('Unsupported image type.'),{status:415});
    if (configured) return putObject(objectKey(id),content,type);
    fs.writeFileSync(path.join(localFolder,id),content,{mode:0o600});
    fs.writeFileSync(path.join(localFolder,id+'.type'),type,{mode:0o600});
  }
  async function hasMaster(id) {
    ensureId(id);
    if (!configured) return fs.existsSync(path.join(localFolder,id));
    try { await client.send(new commands.HeadObjectCommand({Bucket:bucket,Key:objectKey(id)}));return true; }
    catch(error){if(missing(error))return false;throw error;}
  }
  async function getMaster(id) {
    ensureId(id);
    if (!configured) {
      const filepath=path.join(localFolder,id);
      if(!fs.existsSync(filepath))return null;
      return {bytes:fs.readFileSync(filepath),contentType:fs.readFileSync(filepath+'.type','utf8')};
    }
    const object=await getObject(objectKey(id));
    if (!object)return null;
    return {bytes:await streamToBuffer(object.Body,25*1024*1024),contentType:object.ContentType||'image/jpeg'};
  }
  async function putPreview(filename,buffer,type) {
    if(!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(filename))throw new Error('Invalid preview filename.');
    if(configured) await putObject(`gallery-previews/${filename}`,buffer,type);
  }
  async function getPreview(filename) {
    if(!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(filename))return null;
    const obj=await getObject(`gallery-previews/${filename}`);
    return obj?{bytes:await streamToBuffer(obj.Body),contentType:obj.ContentType||'image/jpeg'}:null;
  }
  async function deletePreview(filename) {
    if(configured&&/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(filename))await deleteObject(`gallery-previews/${filename}`);
  }
  async function loadGallery() {
    if(!configured)return null;
    const obj=await getObject('gallery/photos.json');
    if(!obj)return null;
    const photos=JSON.parse((await streamToBuffer(obj.Body,2*1024*1024)).toString('utf8'));
    if(!Array.isArray(photos))throw new Error('R2 gallery manifest is invalid.');
    return photos;
  }
  async function saveGallery(photos) { if(configured)await putObject('gallery/photos.json',Buffer.from(JSON.stringify(photos,null,2)),'application/json'); }
  async function recordPayment(sessionId,entry) {
    if (!/^cs_(?:live|test)_[a-zA-Z0-9_]{6,160}$/.test(sessionId))throw new Error('Invalid payment session ID');
    if(configured)await putObject(`orders/${sessionId}.json`,Buffer.from(JSON.stringify(entry,null,2)),'application/json');
    // Stripe itself is the authoritative payment ledger. R2 is the durable order copy.
  }
  return {configured,idOk,putMaster,hasMaster,getMaster,putPreview,getPreview,deletePreview,loadGallery,saveGallery,recordPayment};
};
