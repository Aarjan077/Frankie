/**
 * Stripe Checkout: sandbox + explicitly gated live mode.
 * Photo copies are delivered only after a Stripe-verified paid Checkout session.
 * Purchased download is the exact same gallery image file (publicly accessible).
 * Fundraising and studio support are separate purposes.
 * Never store or expose API keys in public scripts or GitHub.
 */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ORIGINAL_TITLES = [
  'Greyhound Portrait','Blue in Motion',"Elephant's Gaze",'Still Waters',
  'Coastal Wanderers','Shoreline Treasures','Fox Family','Midair Catch',
  'Looking Beyond','Between Shadows'
];
const PHOTO_COPY_PENCE = 250;
const PHOTO_RIGHTS_PENCE = 30000;
const MIN_STUDIO_PENCE = 100;
const MAX_STUDIO_PENCE = 500000;
const PURCHASE_VALID_SECONDS = 30 * 86400;
const DOWNLOAD_TOKEN_SECONDS = 600;
const yes = (name) => process.env[name] === 'yes';

module.exports = function createPayments({DATA_DIR,IS_PROD,send,validOrigin,readBody,readPhotos,privateStore}) {
  const apiKey=(process.env.STRIPE_SECRET_KEY||'').trim();
  const signingSecret=(process.env.STRIPE_WEBHOOK_SECRET||'').trim();
  const mode = apiKey.startsWith('sk_live_') ? 'live' : 'test';
  const prefix = mode === 'live' ? 'cs_live_' : 'cs_test_';
  const keyValid = apiKey.startsWith(mode==='live'?'sk_live_':'sk_test_') && apiKey.length>14;
  const webhookValid = signingSecret.startsWith('whsec_') && signingSecret.length>12;
  const downloadSigningKey=(process.env.DOWNLOAD_SIGNING_SECRET||'').trim();
  let origin='';
  try {
    const url=new URL((process.env.PUBLIC_SITE_URL||'').trim().replace(/\/$/,''));
    if ((url.protocol==='https:' || (!IS_PROD&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))) &&
        !url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')origin=url.origin;
  }catch{}
  // Two-stage activation: key alone never switches the website to real charges.
  const liveReady=mode==='live' && yes('LIVE_PAYMENTS_ENABLED') && privateStore.configured && downloadSigningKey.length>=32;
  const enabled=Boolean(keyValid&&webhookValid&&origin&&(mode==='test'||liveReady));
  const photoCopiesEnabled=enabled && (mode==='test'||yes('LIVE_PHOTO_SALES_CLEARED'));
  const studioEnabled=enabled && (mode==='test'||yes('LIVE_STUDIO_SUPPORT_CLEARED'));
  // There is no automatic copyright assignment: live rights checkout stays OFF.
  const rightsEnabled=enabled && mode==='test';
  const apiRoot=!IS_PROD&&/^https?:\/\/127\.0\.0\.1:\d+$/.test(process.env.STRIPE_API_BASE||'')
    ? process.env.STRIPE_API_BASE : 'https://api.stripe.com';
  const paymentsFile=path.join(DATA_DIR,'payments.json');
  const tokenKey=mode==='live'?downloadSigningKey:(downloadSigningKey||signingSecret);
  const sessionPattern=/^cs_(?:test|live)_[A-Za-z0-9_]{6,160}$/;

  function configuration() {
    const base={enabled,mode,photoCopiesEnabled,studioEnabled,rightsEnabled,downloadSource:'existing_gallery_file',downloadStorage:privateStore.configured?'private_r2':'temporary_local',
      label:mode==='live'?'Secure Stripe Checkout — live payments':'Stripe sandbox — no real money is collected'};
    if(!enabled)base.message=mode==='live'
      ? 'Live checkout disabled. Configure R2, a signing key, the correct live webhook, LIVE_PAYMENTS_ENABLED=yes and public site URL.'
      : 'Configure the Stripe sandbox key, webhook signing secret and public site URL.';
    return base;
  }
  function photoForId(id) {
    if(typeof id!=='string')return null;
    const original=/^original-(10|[1-9])$/.exec(id);
    if(original)return {id,title:ORIGINAL_TITLES[Number(original[1])-1]};
    if(!privateStore.idOk(id))return null;
    const photo=readPhotos().find(p=>p.id===id);
    return photo?{id,title:String(photo.title).slice(0,80)}:null;
  }
  function amountPence(text) {
    if(typeof text==='number')text=String(text);
    if(typeof text!=='string'||!/^[0-9]{1,4}(?:\.[0-9]{1,2})?$/.test(text))return null;
    const [pounds,sub='']=text.split('.');
    const n=Number(pounds)*100+Number((sub+'00').slice(0,2));
    return Number.isSafeInteger(n)&&n>=MIN_STUDIO_PENCE&&n<=MAX_STUDIO_PENCE?n:null;
  }
  async function stripeRequest(route, options={}) {
    const result=await fetch(`${apiRoot}${route}`,{
      ...options,
      headers:{Authorization:`Bearer ${apiKey}`,...(options.headers||{})},
      signal:AbortSignal.timeout(15000)
    });
    const body=await result.json().catch(()=>null);
    if(!result.ok){
      console.error('Stripe API error:',{status:result.status,code:body?.error?.code||'unknown',param:body?.error?.param||'none',requestId:result.headers.get('request-id')||'unknown'});
      throw Object.assign(new Error('Stripe cannot process this checkout. Please contact Frankie.'),{status:502});
    }
    if(!body)throw Object.assign(new Error('Stripe returned an invalid response.'),{status:502});
    return body;
  }
  function verifySignature(payload,header) {
    if(!webhookValid||typeof header!=='string'||header.length>4096)return false;
    const fields=header.split(',').map(s=>s.trim());
    const stamp=fields.find(f=>f.startsWith('t='))?.slice(2);
    const signatures=fields.filter(f=>/^v1=[a-f\d]{64}$/.test(f)).map(f=>Buffer.from(f.slice(3),'hex'));
    if(!/^\d{10,12}$/.test(stamp||'')||!signatures.length||Math.abs(Math.floor(Date.now()/1000)-Number(stamp))>300)return false;
    const expected=crypto.createHmac('sha256',signingSecret).update(`${stamp}.`).update(payload).digest();
    return signatures.some(s=>crypto.timingSafeEqual(s,expected));
  }
  function validatedPaid(session) {
    if(!session||session.object!=='checkout.session'||!sessionPattern.test(session.id||'')||
       !session.id.startsWith(prefix)||session.livemode!==(mode==='live')||
       session.payment_status!=='paid'||session.currency!=='gbp'||
       !Number.isSafeInteger(session.amount_total))return null;
    const purpose=session.metadata?.purpose;
    const amount=session.amount_total;
    if(purpose==='photo_copy' && amount===PHOTO_COPY_PENCE && privateStore.idOk(session.metadata?.photo_id))return {purpose,photoId:session.metadata.photo_id,amountPence:amount};
    if(purpose==='photo_rights' && amount===PHOTO_RIGHTS_PENCE && mode==='test' && privateStore.idOk(session.metadata?.photo_id))return {purpose,photoId:session.metadata.photo_id,amountPence:amount};
    if(purpose==='studio_support' && amount>=MIN_STUDIO_PENCE && amount<=MAX_STUDIO_PENCE)return {purpose,photoId:null,amountPence:amount};
    return null;
  }
  async function recordPaid(session) {
    const valid=validatedPaid(session);
    if(!valid)return false;
    const entry={sessionId:session.id,...valid,currency:'gbp',mode,paidAt:new Date().toISOString()};
    if(privateStore.configured)await privateStore.recordPayment(session.id,entry);
    else {
      // Sandbox only. Live mode requires R2 and never depends on this ephemeral file.
      let arr=[];try{arr=JSON.parse(fs.readFileSync(paymentsFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}
      if(!arr.some(i=>i.sessionId===session.id)){
        arr.push(entry);
        const temp=`${paymentsFile}.${crypto.randomUUID()}.tmp`;
        fs.writeFileSync(temp,JSON.stringify(arr,null,2),{mode:0o600});fs.renameSync(temp,paymentsFile);
      }
    }
    return true;
  }
  function issueToken(sessionId,expiration) {
    return crypto.createHmac('sha256',tokenKey).update(`${sessionId}:${expiration}`).digest('hex');
  }
  function tokenValid(sessionId,expiration,token) {
    if(!/^\d{10,13}$/.test(expiration||'')||!/^[a-f\d]{64}$/.test(token||''))return false;
    const expiry=Number(expiration);
    if(expiry<=Math.floor(Date.now()/1000)||expiry>Math.floor(Date.now()/1000)+DOWNLOAD_TOKEN_SECONDS+10)return false;
    return crypto.timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(issueToken(sessionId,expiration),'hex'));
  }
  async function getSession(id) {
    if(!sessionPattern.test(id||'')||!id.startsWith(prefix))throw Object.assign(new Error('Invalid checkout reference.'),{status:400});
    const session=await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(id)}`);
    if(session.id!==id||session.livemode!==(mode==='live'))throw Object.assign(new Error('Checkout not found.'),{status:404});
    return session;
  }
  async function handle(req,res,name,url){
    if(!name.startsWith('/api/payments/'))return false;
    res.setHeader('Referrer-Policy','no-referrer');
    if(name==='/api/payments/config'&&req.method==='GET'){send(res,200,configuration());return true;}

    if(name==='/api/payments/checkout'&&req.method==='POST'){
      if(!validOrigin(req)){send(res,403,{error:'Start checkout from the website.'});return true;}
      if(!enabled){send(res,503,{error:'Stripe payments are not enabled yet.'});return true;}
      if(!String(req.headers['content-type']||'').startsWith('application/json')){send(res,415,{error:'Expected JSON.'});return true;}
      const data=JSON.parse((await readBody(req,4096)).toString('utf8'));
      if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Invalid checkout request.'});return true;}
      let title,description,total,photoId='',email='',donorName='';
      if(data.type==='photo_copy'||data.type==='photo_rights'){
        const photo=photoForId(data.photoId);
        if(!photo){send(res,404,{error:'Photograph not found.'});return true;}
        if(data.type==='photo_copy'&&!photoCopiesEnabled){send(res,403,{error:'Photograph sales are not yet enabled.'});return true;}
        if(data.type==='photo_rights'&&!rightsEnabled){send(res,403,{error:'Copyright transfer requires a separate signed agreement. Contact Frankie for licensing.'});return true;}
        // One upload is enough. The exact public gallery file is downloaded after payment.
        // For live sales, this file must exist; admin uploads must be durable in R2.
        if(data.type==='photo_copy' && !(await privateStore.hasGalleryImage(photo.id))){
          send(res,409,{error:'This gallery photograph is temporarily unavailable. Please contact Frankie.'});return true;
        }
        photoId=photo.id;
        total=data.type==='photo_copy'?PHOTO_COPY_PENCE:PHOTO_RIGHTS_PENCE;
        title=data.type==='photo_copy'?`Digital copy — ${photo.title}`:`Photo rights enquiry — ${photo.title}`;
        description=data.type==='photo_copy'
          ? 'One downloadable photograph; personal-use licence only. Separate fundraising terms apply.'
          : 'Sandbox demonstration only; no copyright rights are transferred by payment.';
      }else if(data.type==='studio_support'){
        if(!studioEnabled){send(res,403,{error:'Studio support payments are not currently enabled.'});return true;}
        total=amountPence(data.amount);
        email=typeof data.email==='string'?data.email.trim():'';
        donorName=typeof data.name==='string'?data.name.trim():'';
        if(!total||donorName.length<2||donorName.length>90||email.length>254||!/^\S+@\S+\.\S+$/.test(email)){
          send(res,400,{error:'Enter your name, email and an amount from £1 to £5,000.'});return true;
        }
        title='Frankie Photography — studio project support';
        description='Support for a proposed photography studio, separate from Cancer Research UK. Not a registered charity donation.';
      }else{send(res,400,{error:'Unknown payment type.'});return true;}

      const params=new URLSearchParams();
      params.set('mode','payment');
      params.set('line_items[0][quantity]','1');
      params.set('line_items[0][price_data][currency]','gbp');
      params.set('line_items[0][price_data][unit_amount]',String(total));
      params.set('line_items[0][price_data][product_data][name]',title);
      params.set('line_items[0][price_data][product_data][description]',description);
      params.set('metadata[purpose]',data.type);
      if(photoId){params.set('metadata[photo_id]',photoId);params.set('metadata[photo_title]',title.slice(0,80));}
      if(email)params.set('customer_email',email);
      if(donorName)params.set('metadata[donor_name]',donorName);
      params.set('success_url',`${origin}/payment-result.html?session_id={CHECKOUT_SESSION_ID}`);
      params.set('cancel_url',`${origin}/payment-result.html?cancelled=1`);
      const session=await stripeRequest('/v1/checkout/sessions',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()
      });
      if(!session.id?.startsWith(prefix)||session.livemode!==(mode==='live')||
         !/^https:\/\/checkout\.stripe\.com\//.test(session.url||'')){
        send(res,502,{error:'Stripe returned an unexpected Checkout Session.'});return true;
      }
      send(res,200,{url:session.url});return true;
    }
    if(name==='/api/payments/webhook'&&req.method==='POST'){
      if(!enabled){send(res,503,{error:'Webhook is not configured.'});return true;}
      const raw=await readBody(req,1024*1024);
      if(!verifySignature(raw,req.headers['stripe-signature'])){send(res,400,{error:'Invalid Stripe signature.'});return true;}
      const event=JSON.parse(raw.toString('utf8'));
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
        const session=event.data?.object;
        if(validatedPaid(session))await recordPaid(session);
      }
      send(res,200,{received:true});return true;
    }
    if(name==='/api/payments/status'&&req.method==='GET'){
      if(!enabled){send(res,503,{error:'Payments not configured.'});return true;}
      const session=await getSession(url.searchParams.get('session_id'));
      const paid=validatedPaid(session);
      // Record on the success page too, so fulfilment is not dependent on a redirect
      // or on webhook delivery order. Stripe is always the source of truth.
      if(paid)await recordPaid(session);
      let downloadUrl=null,availability='not_applicable';
      if(paid?.purpose==='photo_copy'){
        availability=await privateStore.hasGalleryImage(paid.photoId)?'ready':'missing_gallery_image';
        if(availability==='ready'){
          const expires=String(Math.floor(Date.now()/1000)+DOWNLOAD_TOKEN_SECONDS);
          const signature=issueToken(session.id,expires);
          downloadUrl=`/api/payments/download?session_id=${encodeURIComponent(session.id)}&expires=${expires}&signature=${signature}`;
        }
      }
      send(res,200,{
        mode,paid:!!paid,purpose:paid?.purpose||session.metadata?.purpose||null,
        amountPence:paid?.amountPence||0,downloadUrl,downloadAvailability:availability,
        customerEmail:session.customer_details?.email?session.customer_details.email.replace(/^(.{1,2}).*(@.*)$/,'$1***$2'):null
      });return true;
    }
    if(name==='/api/payments/download'&&req.method==='GET'){
      if(!enabled){send(res,503,{error:'Downloads are not available.'});return true;}
      const id=url.searchParams.get('session_id');
      const expiry=url.searchParams.get('expires');
      const sig=url.searchParams.get('signature');
      if(!id||!sessionPattern.test(id)||!id.startsWith(prefix)||!tokenValid(id,expiry,sig)){
        send(res,403,{error:'Your download link is invalid or has expired. Return to the payment confirmation page for a fresh link.'});return true;
      }
      const session=await getSession(id);
      const paid=validatedPaid(session);
      if(!paid||paid.purpose!=='photo_copy'){
        send(res,403,{error:'A verified paid photograph order is required.'});return true;
      }
      if(Math.floor(Date.now()/1000)-(session.created||0)>PURCHASE_VALID_SECONDS){
        send(res,410,{error:'This order’s automatic download period has ended. Please contact Frankie.'});return true;
      }
      const original=await privateStore.getGalleryImage(paid.photoId);
      if(!original){send(res,404,{error:'The gallery photograph is temporarily unavailable. Contact Frankie for assistance.'});return true;}
      const allowedTypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
      const ext=allowedTypes[original.contentType]||'jpg';
      const photo=photoForId(paid.photoId);
      const filename=((photo?.title||'Frankie Photography').normalize('NFKD').replace(/[^a-zA-Z0-9 -]/g,'').trim().replace(/\s+/g,'-')||'Frankie-Photography').slice(0,70)+'.'+ext;
      res.writeHead(200,{
        'Content-Type':original.contentType,'Content-Length':original.bytes.length,
        'Content-Disposition':`attachment; filename="${filename}"`,
        'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'
      });res.end(original.bytes);return true;
    }
    send(res,404,{error:'Not found.'});return true;
  }
  if(mode==='live'&&!enabled)console.warn('STRIPE LIVE PAYMENTS ARE LOCKED. Configure R2, DOWNLOAD_SIGNING_SECRET, LIVE_PAYMENTS_ENABLED=yes, the live webhook, and public URL.');
  return {handle,configuration,verifySignature};
};
