/**
 * Stripe Checkout (TEST MODE ONLY) for Frankie Photography.
 * Node 22+ built-in fetch and HMAC; no external packages or public secrets.
 * - Server owns photo prices and validates every product id.
 * - Studio contributions are distinct from intended Cancer Research UK sales.
 * - Webhooks are verified against RAW request bytes before recording successes.
 * - No digital deliveries, copyright assignments, live charges or charity transfers.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ORIGINAL_TITLES = Object.freeze([
  'Greyhound Portrait', 'Blue in Motion', "Elephant's Gaze", 'Still Waters',
  'Coastal Wanderers', 'Shoreline Treasures', 'Fox Family', 'Midair Catch',
  'Looking Beyond', 'Between Shadows'
]);
const COPY_PENCE = 250;
const RIGHTS_PENCE = 30000;
const MIN_STUDIO_PENCE = 100;
const MAX_STUDIO_PENCE = 500000;

module.exports = function setupPaymentApi({DATA_DIR, IS_PROD, send, validOrigin, readBody, readPhotos}) {
  const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const siteUrlString = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const isSandboxKey = stripeSecret.startsWith('sk_test_') && stripeSecret.length > 14;
  const hasWebhookSecret = webhookSecret.startsWith('whsec_') && webhookSecret.length > 12;
  let siteOrigin = '';
  try {
    const site = new URL(siteUrlString);
    const safeScheme = site.protocol === 'https:' || (!IS_PROD && site.protocol === 'http:' && site.hostname === 'localhost');
    if (safeScheme && !site.username && !site.password && !site.search && !site.hash && (site.pathname === '/' || !site.pathname)) {
      siteOrigin = site.origin;
    }
  } catch { /* disabled until configured */ }
  // In a public environment this project intentionally refuses ALL sk_live_ keys.
  // This prevents premature selling / collecting contributions before legal approval.
  const enabled = Boolean(isSandboxKey && hasWebhookSecret && siteOrigin);
  const apiRoot = !IS_PROD && /^https?:\/\/127\.0\.0\.1:\d+$/.test(process.env.STRIPE_API_BASE || '')
    ? process.env.STRIPE_API_BASE
    : 'https://api.stripe.com';
  const paymentsFile = path.join(DATA_DIR, 'payments.json');

  function readPayments() {
    try {
      const records = JSON.parse(fs.readFileSync(paymentsFile, 'utf8'));
      if (!Array.isArray(records)) throw new Error('Invalid payment records');
      return records;
    } catch(error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  function savePayments(records) {
    const temporary = `${paymentsFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(records, null, 2) + '\n', { flag:'wx', mode:0o600 });
    fs.renameSync(temporary, paymentsFile);
  }

  function paymentConfiguration() {
    return {
      enabled, mode:'test',
      label:'Stripe sandbox — no real money is collected',
      ...(!enabled ? {message:'Configure STRIPE_SECRET_KEY (sk_test_), STRIPE_WEBHOOK_SECRET and PUBLIC_SITE_URL on Render.'} : {})
    };
  }
  function safeAmount(amount) {
    const text = typeof amount === 'number' ? String(amount) : amount;
    if (typeof text !== 'string' || !/^\d{1,4}(?:\.\d{1,2})?$/.test(text)) return null;
    const [pounds, pence=''] = text.split('.');
    const pennies = Number(pounds) * 100 + Number((pence+'00').slice(0,2));
    if (!Number.isSafeInteger(pennies) || pennies < MIN_STUDIO_PENCE || pennies > MAX_STUDIO_PENCE) return null;
    return pennies;
  }
  function photoForId(id) {
    const match = /^original-(10|[1-9])$/.exec(id || '');
    if (match) return { id, title:ORIGINAL_TITLES[Number(match[1])-1] };
    if (typeof id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id)) return null;
    const photo = readPhotos().find(photo => photo.id === id);
    return photo ? { id:photo.id, title:photo.title.slice(0,80) } : null;
  }
  async function stripeRequest(route, options={}) {
    const response = await fetch(`${apiRoot}${route}`, {
      ...options,
      headers:{Authorization:`Bearer ${stripeSecret}`, ...(options.headers || {})},
      signal:AbortSignal.timeout(15000)
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Stripe did not return valid JSON.'); }
    if (!response.ok) {
      // Safe diagnostics: never log API keys, email addresses or request bodies.
      console.error('Stripe API error:', { status:response.status, type:payload?.error?.type || 'unknown', code:payload?.error?.code || 'unknown', parameter:payload?.error?.param || 'none', requestId:response.headers.get('request-id') || 'unknown' });
      throw Object.assign(new Error('Stripe could not start this test checkout. Please check your sandbox configuration.'), { status:502 });
    }
    return payload;
  }
  function verifyStripeSignature(rawBody, header) {
    if (!hasWebhookSecret || typeof header !== 'string' || header.length > 4096) return false;
    const pieces = header.split(',').map(part => part.trim());
    const timestampText = pieces.find(s => s.startsWith('t='))?.slice(2);
    const signatures = pieces.filter(s => /^v1=[a-f0-9]{64}$/.test(s)).map(s => s.slice(3));
    if (!timestampText || !/^\d{10,12}$/.test(timestampText) || !signatures.length) return false;
    const timestamp = Number(timestampText);
    if (Math.abs(Math.floor(Date.now()/1000) - timestamp) > 300) return false;
    const expected = crypto.createHmac('sha256', webhookSecret)
      .update(`${timestamp}.`).update(rawBody).digest();
    return signatures.some(s => crypto.timingSafeEqual(Buffer.from(s, 'hex'), expected));
  }
  async function handle(req, res, name, url) {
    if (!name.startsWith('/api/payments/')) return false;

    if (name === '/api/payments/config' && req.method === 'GET') {
      send(res, 200, paymentConfiguration());
      return true;
    }

    if (name === '/api/payments/checkout' && req.method === 'POST') {
      if (!validOrigin(req)) { send(res, 403, {error:'Start checkout from the website.'}); return true; }
      if (!enabled) { send(res, 503, {error:'Stripe sandbox is not ready. Configure the test key, webhook secret and public site URL in Render.'}); return true; }
      const contentType = req.headers['content-type'] || '';
      if (!String(contentType).startsWith('application/json')) { send(res, 415, {error:'Expected a JSON request.'}); return true; }
      const data = JSON.parse((await readBody(req, 4096)).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) { send(res,400,{error:'Invalid checkout request.'}); return true; }

      const kind = data.type;
      let title, amountPence, description, photoId = '', email = '', donorName = '';
      if (kind === 'photo_copy' || kind === 'photo_rights') {
        const photo = photoForId(data.photoId);
        if (!photo) { send(res,404,{error:'Photograph not found.'}); return true; }
        photoId = photo.id;
        title = kind === 'photo_copy' ? `Photograph copy — ${photo.title}` : `Photo rights option — ${photo.title}`;
        amountPence = kind === 'photo_copy' ? COPY_PENCE : RIGHTS_PENCE;
        description = kind === 'photo_copy'
          ? 'Photography purchase — sandbox test. Digital image delivered manually after a real order is confirmed.'
          : 'Photography rights — sandbox test. Rights transfer requires a separately signed written agreement.';
      } else if (kind === 'studio_support') {
        amountPence = safeAmount(data.amount);
        donorName = typeof data.name === 'string' ? data.name.trim() : '';
        email = typeof data.email === 'string' ? data.email.trim() : '';
        if (!amountPence || donorName.length < 2 || donorName.length > 90 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
          send(res,400,{error:'Please provide your name, a valid email and an amount between £1 and £5,000.'}); return true;
        }
        title = 'Frankie Photography — future studio support';
        description = 'Sandbox only. Studio project support is separate from Cancer Research UK sales. Not a charitable donation.';
      } else { send(res,400,{error:'Unknown product or contribution type.'}); return true; }

      const parameters = new URLSearchParams();
      parameters.set('mode','payment');
      // Modern Stripe API versions (2026-09-30.endive onward) reject
      // payment_method_types on Checkout Sessions. Use Stripe Dashboard settings.
      parameters.set('line_items[0][quantity]','1');
      parameters.set('line_items[0][price_data][currency]','gbp');
      parameters.set('line_items[0][price_data][unit_amount]',String(amountPence));
      parameters.set('line_items[0][price_data][product_data][name]',title);
      parameters.set('line_items[0][price_data][product_data][description]',description);
      parameters.set('metadata[purpose]',kind);
      if (photoId) { parameters.set('metadata[photo_id]',photoId); parameters.set('metadata[photo_title]',title.slice(0,90)); }
      if (email) parameters.set('customer_email',email);
      if (donorName) parameters.set('metadata[donor_name]',donorName);
      // Donor name is handled by Stripe and is not saved to local payment records.
      parameters.set('success_url',`${siteOrigin}/payment-result.html?session_id={CHECKOUT_SESSION_ID}`);
      parameters.set('cancel_url',`${siteOrigin}/payment-result.html?cancelled=1`);
      const session = await stripeRequest('/v1/checkout/sessions', {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:parameters.toString()
      });
      if (session?.livemode === true || !/^cs_test_[A-Za-z0-9_]+$/.test(session?.id || '') ||
          typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/')) {
        send(res,502,{error:'Stripe returned an unexpected checkout session.'}); return true;
      }
      send(res,200,{url:session.url});
      return true;
    }

    if (name === '/api/payments/webhook' && req.method === 'POST') {
      if (!enabled) { send(res,503,{error:'Webhook not configured.'}); return true; }
      const raw = await readBody(req, 1024*1024);
      if (!verifyStripeSignature(raw,req.headers['stripe-signature'])) {
        send(res,400,{error:'Invalid Stripe signature.'}); return true;
      }
      const event = JSON.parse(raw.toString('utf8'));
      // Handle only successfully paid TEST Checkout Sessions, including delayed payments.
      if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
        const session = event.data?.object;
        const acceptablePurposes = ['photo_copy','photo_rights','studio_support'];
        if (session?.object === 'checkout.session' && session.livemode === false &&
            /^cs_test_[A-Za-z0-9_]+$/.test(session.id || '') &&
            session.payment_status === 'paid' && session.currency === 'gbp' &&
            Number.isSafeInteger(session.amount_total) && session.amount_total > 0 &&
            acceptablePurposes.includes(session.metadata?.purpose)) {
          const current = readPayments();
          if (!current.some(p => p.sessionId === session.id)) {
            const item = {
              sessionId:session.id, purpose:session.metadata.purpose,
              photoId:session.metadata.photo_id || null,
              amountPence:session.amount_total, currency:'gbp',
              confirmedAt:new Date().toISOString(), testOnly:true
            };
            current.push(item);
            savePayments(current);
            console.log('Stripe sandbox payment confirmed:',item.purpose,item.amountPence,'pence');
          }
        }
      }
      send(res,200,{received:true});
      return true;
    }

    if (name === '/api/payments/status' && req.method === 'GET') {
      if (!enabled) { send(res,503,{error:'Stripe sandbox not configured.'}); return true; }
      const sessionId = url.searchParams.get('session_id');
      if (!sessionId || !/^cs_test_[A-Za-z0-9_]{6,160}$/.test(sessionId)) {
        send(res,400,{error:'Invalid checkout session.'}); return true;
      }
      // Read directly from Stripe; the browser cannot mark an order paid.
      const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (session.livemode !== false || session.id !== sessionId) {
        send(res,404,{error:'Session not found.'}); return true;
      }
      send(res,200,{
        mode:'test', paid:session.payment_status === 'paid',
        amountPence:Number.isSafeInteger(session.amount_total) ? session.amount_total : 0,
        purpose:session.metadata?.purpose || 'test_checkout'
      });
      return true;
    }
    send(res,404,{error:'Not found.'});
    return true;
  }
  if (stripeSecret.startsWith('sk_live_')) console.error('LIVE STRIPE KEY REFUSED: this build allows only sandbox keys.');
  if (!enabled) console.warn('Stripe test checkout disabled until STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and PUBLIC_SITE_URL are configured.');
  return {handle, verifyStripeSignature, paymentConfiguration};
};
