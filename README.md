# Frankie Photography — payments and private digital downloads

This is the next version of Frankie's full-stack Node.js website. It retains the existing portfolio, 10 photographs, Large/Small gallery, admin dashboard, music, dark mode, About and Studio features. It adds **live-capable Stripe Checkout with explicit launch safeguards** and **customer digital downloads from a private Cloudflare R2 bucket**.

**No real payments are enabled just by uploading these files.** Real sales require a Stripe live account, a separate live webhook, private storage, clearance of the fundraising and studio-project arrangements, and explicit Render environment flags. Live rights/copyright transfers are disabled entirely until there is a signed agreement flow.

## What the customer sees

1. Open any gallery photograph and choose **Buy a Copy — £2.50**. The backend checks the price and, in live mode, confirms a **private downloadable original** has been uploaded.
2. The customer pays on Stripe's hosted checkout using their own card, not on Frankie's server.
3. Stripe redirects to `payment-result.html?session_id=...`. The result page asks Stripe server-side whether the payment is **paid**.
4. The successful customer can click **Download Photograph**. The URL is signed for 10 minutes, and the server verifies the paid Stripe Checkout session again before serving the private original. Revisit the confirmation page within 30 days to get a new 10-minute link.
5. The same paid checkout is independently processed by a **signature-verified Stripe webhook** and recorded in R2 under `orders/` (private).

**The £300 copyright rights option remains test-only.** Copyright is not automatically transferred: use a separately signed rights-assignment document and a clearly specified licence/transfer workflow before collecting real money for it.

**This version provides the download button on the payment confirmation page, NOT an email containing the file.** Stripe can separately send payment receipts if enabled in its dashboard. If automatic delivery emails are needed, a verified email provider and additional consent/anti-abuse controls will be required.

## Important legal and financial checks BEFORE enabling live mode

- **Photo sales advertised as benefiting Cancer Research UK:** Frankie must contact Cancer Research UK and resolve whether a **Commercial Participator Agreement** is needed before advertising/selling under their name. Their published fundraising terms state that business-related fundraising can require such an agreement and restrict use of their branding. Contact: `supporter.services@cancer.org.uk`. Agree and document exactly what percentage reaches the charity, who covers Stripe fees and when the transfer happens. **This code does not automatically send sale money to the charity.** Revenue first goes to the bank linked to Frankie's Stripe account.
- **Studio support:** This is funding Frankie's own proposed studio, **not** a registered-charity donation. Frankie should confirm this fundraising arrangement is supported by Stripe and complies with applicable legal/tax rules. It cannot be presented as Gift Aid eligible.
- Confirm Frankie's Stripe account has **live charges and bank payouts enabled**. Only Frankie should provide identity and banking information to Stripe directly. Set up refunds, terms of sale, a privacy notice and contact information before live orders.
- **£8,347 / £30,000** in the studio display is a **prototype figure**, not a real transaction balance. Change or clearly label it before live fundraising.
- The public `gallery-1.jpg`–`gallery-10.jpg` photos and any existing uploaded previews can be saved by any visitor. Use **reduced-resolution gallery previews** and a separate full-quality file uploaded via the admin dashboard for paid downloads. This implementation does not make previously published images inaccessible.

Official guidance: https://www.cancerresearchuk.org/terms-and-conditions-for-fundraising-activities and https://support.stripe.com/questions/requirements-for-accepting-tips-or-donations?locale=en-GB

## 1. Upload the new code to GitHub

Use `UPLOAD_TO_GITHUB.txt` for the complete list. Replace/update the specified files in `Aarjan077/Frankie` and commit. Do **not** upload `data/`, `.env` or private originals. The public gallery photos, music, portraits, etc. can remain as they were.

In Render make sure **Build Command** is `npm install` and **Start Command** is `npm start` (Node.js 22+). Render will install the added `@aws-sdk/client-s3` package from `package.json`.

## 2. Configure a private Cloudflare R2 bucket (required for REAL paid downloads)

1. In your own Cloudflare account, open **R2 Object Storage**, create a bucket such as `frankie-private`, use **Standard** storage and leave all public URL/public access settings **disabled**.
2. Create an **R2 API token** scoped to that bucket with **read/write object permissions**, saving the **Access Key ID** and **Secret Access Key** only inside Render.
3. Find the Cloudflare **Account ID** in your Cloudflare dashboard.
4. In Render → your Web Service → Environment, set:

| Key | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 token Secret Access Key |
| `R2_BUCKET` | Private bucket name, e.g. `frankie-private` |

R2 stores uploaded gallery previews in `gallery-previews/`, metadata in `gallery/photos.json`, buyer downloads in `private-originals/`, and payment records in `orders/`. None is publicly browsable through R2. The existing `/uploads/...` preview endpoint continues to work as before, but now fetches from R2.

**Important migration warning:** photographs previously uploaded through the admin dashboard while using Render's free, ephemeral `DATA_DIR=./data` are not automatically recovered if they've already disappeared. Recover/re-upload those from Frankie's own copies. This release persists new uploads after R2 is configured. Do not store paid images only on the Render free filesystem: Render deletes it on restarts/spin-downs.

Official: https://developers.cloudflare.com/r2/get-started/s3/ , https://developers.cloudflare.com/r2/pricing/ , https://render.com/docs/free

## 3. Upload private, high-resolution customer originals

1. Open your Render website's `/admin.html` and sign in with the existing strong admin credentials.
2. Scroll below **Your gallery** to **03 / CUSTOMER DOWNLOADS**.
3. Select one of the 10 existing photos or any Frankie-uploaded gallery photo.
4. Upload a JPG/PNG/WebP high-resolution master (maximum **25 MB**) and choose **SAVE PRIVATE ORIGINAL**.
5. Repeat for every photograph you want to sell. The gallery previews remain unchanged.

The private file is not exposed on a URL. After payment, the backend serves it only when Stripe verifies a paid order. Deleting a gallery preview does not erase past customers' private master, so an earlier order can still be fulfilled. Contact Frankie if you need to revoke a particular file.

## 4. Test everything first using the EXISTING Stripe sandbox

Keep the existing `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` from the **test** webhook, and `PUBLIC_SITE_URL=https://frankiephotography.onrender.com`. Add R2 and the private originals as above.

Open `https://frankiephotography.onrender.com/api/payments/config`. You should see:

```json
{"enabled":true,"mode":"test","photoCopiesEnabled":true,"studioEnabled":true,"rightsEnabled":true,"downloadStorage":"private_r2"}
```

Make a £2.50 test purchase with Stripe's test card `4242 4242 4242 4242`, any future expiry date and any three-digit CVC. On the receipt page, click **DOWNLOAD PHOTOGRAPH**. Confirm the file opens and matches the one uploaded privately. Also test studio support in the sandbox and check Stripe → Workbench → Webhooks → Event deliveries for HTTP **200**. Check that `orders/` in R2 receives the verified receipt. No real money moves in sandbox.

## 5. Prepare the LIVE Stripe account

In Frankie's Stripe Dashboard, **leave Sandbox** and finish business identity, account verification, bank account and payout configuration. Live keys are **different from test keys**. Create a **separate LIVE event destination** pointing to exactly:

`https://frankiephotography.onrender.com/api/payments/webhook`

Choose `checkout.session.completed` and `checkout.session.async_payment_succeeded` Snapshot events. Copy its separate **LIVE** `whsec_...` into Render — do not reuse the test webhook signing secret.

Create a random independent signing secret on your own machine:

`node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`

Copy its result privately into Render as `DOWNLOAD_SIGNING_SECRET` (keep it for future deployments; changing it invalidates old short-lived download links).

## 6. LAST STEP: unlock each LIVE category *only after its prerequisites are confirmed*

In Render → Environment, update these variables, **without sharing values in chat/GitHub**:

| Key | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_...` from Frankie's live account |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the LIVE destination |
| `PUBLIC_SITE_URL` | `https://frankiephotography.onrender.com` (no path/query) |
| `DOWNLOAD_SIGNING_SECRET` | At least 32-character random private value |
| `LIVE_PAYMENTS_ENABLED` | `yes` **only when ready** |
| `LIVE_PHOTO_SALES_CLEARED` | `yes` **only after Cancer Research UK/fundraising clearance** |
| `LIVE_STUDIO_SUPPORT_CLEARED` | `yes` **only after Stripe confirms the studio support arrangement is supported** |

R2 must also be configured, and each purchased photo must have a private original. The production checkout refuses live keys unless `LIVE_PAYMENTS_ENABLED=yes`, R2 is configured and `DOWNLOAD_SIGNING_SECRET` has sufficient entropy. Even then, photography sales and studio contributions are separately disabled until their approval flags are set to `yes`. The £300 rights/copyright checkout is always **disabled in live mode**.

Click **Save and deploy**, wait for Render to report **Live**, then check `/api/payments/config` shows `"mode":"live"` and the correct enabled categories. Carefully perform a low-value **real** payment using an authorised actual card; check the Stripe live webhook delivery, R2 `orders/`, the download, the customer's receipt, Frankie's payout settings, and refund flow. A live payment incurs real Stripe fees, and a Stripe payout is not a charity transfer.

## Security/limitations

- Public `GET /api/payments/config` contains only booleans and the mode, **no API keys**.
- No card details touch the website. The customer pays on `checkout.stripe.com`.
- Checkout price (£2.50 or £300) is determined by the backend. Public requests cannot choose a cheaper price.
- Webhook `Stripe-Signature` is verified using raw body, timing-safe HMAC and a five-minute timestamp tolerance.
- The status page re-fetches the session from Stripe; the browser cannot mark itself paid.
- The photo download requires a signed 10-minute token, a Stripe-verified paid order, the correct image ID, and a private stored image. No R2 credentials are exposed to customers.
- Automatic links can be refreshed from the buyer's confirmation page for 30 days. If they lose that page, Frankie needs an order support/re-issue procedure; this release does not yet send automatic image-delivery emails.
- Stripe handles payout to Frankie's verified bank account on the payout schedule. This code does **not** automatically forward funds to Cancer Research UK.
- The site does not automatically issue licences/assign copyright for £300 rights purchases. The digital copy is explicitly for personal use only.
- Free Render instances are suitable for demos, not robust production uptime. R2 makes object storage persistent but the web service can still spin down. Upgrade hosting as business needs grow.

## Run locally

```
npm install
npm start
```

For sandbox development without R2, private originals are temporarily saved under `DATA_DIR/private-originals/`. **Live mode never uses this local fallback.** `npm test` runs syntax and local integration checks. Store secrets in local `.env` (ignored by Git) or Render Environment, never in public files.
