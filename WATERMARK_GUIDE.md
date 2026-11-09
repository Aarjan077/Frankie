# Frankie — watermarked free downloads

## What is different

- Existing gallery photographs (GitHub `gallery-1.jpg` ... `gallery-10.jpg`) and newly uploaded gallery photos remain **clean and unchanged on the website**.
- A new **DOWNLOAD WITHOUT PAYING / WATERMARKED COPY** link appears under each gallery photograph's Buy buttons.
- On desktop, right-clicking a gallery photograph displays a compact menu with a **Download Watermarked Photo** option instead of the normal browser image menu.
- The website generates the actual downloaded JPG/PNG/WebP on its server using Sharp and burns repeated diagonal `THANK YOU` text into the image. The file keeps the source image dimensions, even if high-resolution.
- Paid Stripe-confirmed downloads return the original, **without a watermark**.
- Covers all 10 bundled gallery files and new photographs uploaded by Frankie into Cloudflare R2.

## University-prototype limitation

The browser still receives the clean photo for display. A visitor can save that public image using browser developer tools, direct image URLs, screenshots, or other methods. No website can make an already-public clean image impossible to copy. This feature reliably watermarks the **provided unpaid download action**, not every possible external copying method.

## GitHub deployment

Replace `index.html`, `style.css`, `script.js`, `server.js`, and `package.json`; **add `watermark-download.js`**. No photo files, payment API, admin or R2 settings change.

Your Render Build Command `npm install` installs the new `sharp` dependency. Keep `npm start` as Start Command. When Render shows **Live**, open any photo, click **Download Without Paying**, and verify the saved file contains repeated `THANK YOU` watermark. Then run a £2.50 Stripe sandbox checkout to confirm the paid original is still clean.

Do not upload `.env` or private keys to GitHub.
