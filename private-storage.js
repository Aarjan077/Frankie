/**
 * Gallery image delivery (exact bytes as displayed in the public gallery).
 * Original gallery-1.jpg to gallery-10.jpg live in the application/GitHub repo.
 * New admin uploads live in Cloudflare R2 (and in a local sandbox fallback).
 * Stripe payment verification happens in payment-api.js, not in this storage module.
 * IMPORTANT: public full-resolution images remain freely saveable by visitors.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const VALID_ID = /^(?:original-(?:10|[1-9])|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

module.exports = function createPrivateStorage(dataDir, rootDir = __dirname, loadPhotos = () => []) {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET || '').trim();
  const configured = Boolean(accountId && accessKeyId && secretAccessKey && bucket);
  const uploadFolder = path.join(dataDir, 'uploads');
  let client, commands;
  if (configured) {
    commands = require('@aws-sdk/client-s3');
    client = new commands.S3Client({
      region:'auto', endpoint:`https://${accountId}.r2.cloudflarestorage.com`,
      credentials:{accessKeyId,secretAccessKey}, forcePathStyle:true,
      maxAttempts:2
    });
  } else fs.mkdirSync(uploadFolder,{recursive:true});

  function idOk(id) { return typeof id === 'string' && VALID_ID.test(id); }
  function ensureId(id) { if (!idOk(id)) throw Object.assign(new Error('Invalid photo ID.'),{status:400}); }

  function missing(error) { return error?.name === 'NotFound' || error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404; }
  async function putObject(Key, Body, ContentType='application/octet-stream') {
  if (!configured) throw new Error('Cloud storage is not configured.');
  await client.send(new commands.PutObjectCommand({Bucket:bucket,Key,Body,ContentType}));
}
  async function getObject(Key) {
  if (!configured) throw new Error('Cloud storage is not configured.');
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

const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
  function galleryFilename(id) {
  ensureId(id);
  if (id.startsWith('original-')) return `gallery-${Number(id.slice(9))}.jpg`;
  const item=loadPhotos().find(photo=>photo.id===id);
  return item && /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(item.file) ? item.file : null;
}
  async function findUploadedPhoto(id, needBody=false) {
  ensureId(id);
  // Existing admin uploads are retained in R2, and deleted-gallery photos are
  // archived in the private bucket for customers with valid older purchases.
  const known=galleryFilename(id);
  const filenames=known?[known]:['jpg','png','webp'].map(ext=>`${id}.${ext}`);
  for(const file of filenames) {
    const ext=file.split('.').at(-1).toLowerCase();
    if (!types[ext]) continue;
    if(configured) {
      for(const prefix of ['gallery-previews','past-purchases']) {
        const Key=`${prefix}/${file}`;
        if(!needBody) {
          try {await client.send(new commands.HeadObjectCommand({Bucket:bucket,Key}));return {filename:file,contentType:types[ext]};}
          catch(error){if(missing(error))continue;throw error;}
        }
        const object=await getObject(Key);
        if(object)return {filename:file,contentType:object.ContentType||types[ext],bytes:await streamToBuffer(object.Body,25*1024*1024)};
      }
    } else {
      const filePath=path.join(uploadFolder,file);
      if(fs.existsSync(filePath))return {filename:file,contentType:types[ext],...(needBody?{bytes:fs.readFileSync(filePath)}:{})};
    }
  }
  return null;
}
  async function hasGalleryImage(id) {
  ensureId(id);
  if(id.startsWith('original-')) {
    try {return (await fs.promises.stat(path.join(rootDir,galleryFilename(id)))).isFile();}
    catch(error){if(error.code==='ENOENT')return false;throw error;}
  }
  return Boolean(await findUploadedPhoto(id,false));
}
  async function getGalleryImage(id) {
  ensureId(id);
  if(id.startsWith('original-')) {
    const filename=galleryFilename(id);
    try{return {bytes:await fs.promises.readFile(path.join(rootDir,filename)),contentType:'image/jpeg'};}
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  const found=await findUploadedPhoto(id,true);
  return found?{bytes:found.bytes,contentType:found.contentType}:null;
}
  async function archivePreview(filename) {
  if(!configured) return;
  if(!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(filename))throw new Error('Invalid preview filename.');
  const original=await getPreview(filename);
  if(original) {
    await putObject(`past-purchases/${filename}`,original.bytes,original.contentType);
  }
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
  return {configured,idOk,hasGalleryImage,getGalleryImage,putPreview,getPreview,deletePreview,archivePreview,loadGallery,saveGallery,recordPayment};
};
