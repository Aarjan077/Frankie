# Frankie Photography — one-upload gallery photos + verified Stripe downloads

This update makes a **£2.50 photograph purchase deliver the exact file already in the public gallery**. Frankie does **not** have to upload an additional "private original". The existing portfolio design, gallery Large/Small view, login, admin image uploads, theme, music, £300 sandbox rights option, Stripe checks, studio support form and charity-related live safety switches remain in place.

## How it works now

| Photograph | Gallery image source | File customers download after a paid Stripe purchase |
| --- | --- | --- |
| Original photographs 1–10 | `gallery-1.jpg` … `gallery-10.jpg` in the GitHub repository, deployed on Render | **Those exact JPG bytes** from the deployed website |
| New photographs Frankie uploads through `/admin.html` | `gallery-previews/` in Cloudflare R2, displayed through `/uploads/<filename>` | **Those same bytes** fetched from R2 |

Stripe verifies the paid Checkout Session **on the backend**. The website returns a download link that expires after **10 minutes**. Buyers who revisit the original payment-confirmation page within **30 days** can request a new download link. This release does not email purchased files automatically.

### Important: the photos are already public

All original and newly published gallery photographs are available to visitors at their **full uploaded resolution**, even without a purchase. Visitors can save images through their browser or the public URLs. The paid download provides a convenient transaction and an `attachment` download of the same photograph; **it does not prevent unpaid downloads or protect the image from copying**. Do not describe the pictures as exclusively accessible to paying customers. If Frankie wants protected high-resolution downloads later, you will need reduced-resolution/watermarked previews plus private masters (or automatic private-original handling).

## Step 1 — Upload the code to GitHub

Use **GITHUB_UPDATE.zip** and copy the files inside to the **root** of `Aarjan077/Frankie`. Replace existing files with identical names; commit changes and wait until Render reports **Live**. Files to replace:

- `server.js` — serves and validates gallery download files
- `private-storage.js` — reads existing GitHub images and R2 gallery files, archives photos removed from the gallery
- `payment-api.js` — uses the gallery file for checked-out downloads; preserves Stripe verification and live safety flags
- `admin.html` and `admin.js` — removes unnecessary second-file upload UI
- `admin.css` — retains the same styling, with updated section comment
- `payment-result.js` — changes payment confirmation wording
- `index.html` — clarifies copy purchase terms
- `package.json` — updated version and test script
- `README.md`, `UPLOAD_TO_GITHUB.txt` — instructions

**Do not upload a `.env` file, secret keys, banking data, or `data/` to GitHub.** Leave the original ten gallery pictures and all About/homepage/music assets untouched.

## Step 2 — Verify existing Render and R2 configuration

You do **not** need another R2 token or another bucket if your current setup works. Keep these private Render Environment variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET=frankie-private`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`

Make sure `npm install` is the Render build command and `npm start` is the start command. Keep Stripe in **test mode** while checking this update.

Cloudflare R2 is still required for **durable admin-uploaded photographs** and payment records in live mode. The public gallery images and R2 bucket are separate: original ten images are deployed with GitHub and do not need a duplicate upload to R2. A newly uploaded photograph is sent to the gallery once and stored in R2.

## Step 3 — Check purchases in Stripe Sandbox

1. Open `https://frankiephotography.onrender.com/api/payments/config`. Look for `enabled:true`, `mode:"test"`, `downloadSource:"existing_gallery_file"`; `downloadStorage:"private_r2"` confirms the R2 configuration is present.
2. Open any original gallery photograph, press **Buy a Copy — £2.50**, and complete Stripe Checkout with test card **4242 4242 4242 4242**, any future expiry and any 3-digit CVC.
3. On `payment-result.html`, click **DOWNLOAD PHOTOGRAPH**. Compare the downloaded file with the matching `gallery-N.jpg` (file bytes are unchanged).
4. From `/admin.html`, publish one new photo (maximum 10 MB JPG/PNG/WebP). The **same file** should appear in the public gallery and become available to the buyer after an identical test payment, with **no additional upload step**.
5. In Stripe Sandbox → Workbench → Webhooks → Event deliveries, ensure the matching `checkout.session.completed` gets HTTP **200**. In R2, a verified record should appear in `orders/`.

If a previously uploaded photo vanishes after a Render restart, it may have existed only in Render's temporary filesystem before you configured R2. Such files need to be re-uploaded by Frankie to the admin gallery. This update cannot recover deleted uploads.

## Deleting gallery photographs

Removing a new photo from the admin dashboard hides it from the active gallery and public `/uploads/` endpoint. The server moves the R2 file to `past-purchases/` before removal so earlier buyers can keep using the paid confirmation page during their **30-day** download period. Previously uploaded `private-originals/` objects from older versions are unused by this update.

## Real payments — keep disabled until approved and tested

This update **does not** turn on live Stripe charges. Use the same separate live Stripe keys, live webhook and explicit Render flags explained in the previous version's setup, **only after** the correct requirements are met:

- The Stripe account belongs to Frankie, is identity-verified, and has live charges and bank payouts enabled.
- Confirm photography sales **in aid of Cancer Research UK** meet the charity's fundraising/business participation rules and the website correctly states exactly how proceeds, fees and transfers work. **This code does not transfer money to the charity automatically.**
- Confirm studio contributions are permitted and accurately described as studio/project support, not registered-charity donations or Gift Aid.
- Set clear refunds, fulfilment, licensing and privacy terms. £2.50 is a personal-use digital copy; the £300 rights option stays disabled for real money until a signed rights agreement is ready.
- The **£8,347** studio progress number is illustrative and must not be presented as verified actual contributions.

For live mode, this backend still requires private R2 configuration, a sufficiently long `DOWNLOAD_SIGNING_SECRET` (minimum 32 characters), live Stripe credentials, a matching live webhook, `LIVE_PAYMENTS_ENABLED=yes` and separate approval flags. Keep these flags **off** until genuinely ready. You do not need to change anything for sandbox testing.

## Local tests

Node.js 22+:

```bash
npm install
npm test
npm start
```

The tests cover exact byte-for-byte GitHub downloads, a one-time admin upload, sandbox checkout, expired/forged download links, order recording, delete behaviour, the R2 object lifecycle with a local simulated R2 client, live-payment locks and webhook signatures. Simulated tests do **not** charge real money or access your Cloudflare account.
