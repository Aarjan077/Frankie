/**
 * Frankie free / unpaid download renderer.
 * The visible gallery is left untouched. On free downloads only, the server
 * permanently burns repeated THANK YOU text into the returned image bytes.
 * Stripe-confirmed paid downloads continue to return the uploaded original.
 */
'use strict';
const sharp = require('sharp');

const WATERMARK = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="840" height="480" viewBox="0 0 840 480">
  <g transform="rotate(-25 420 240)"
     font-family="Arial, Helvetica, sans-serif" font-weight="700"
     letter-spacing="4" font-size="53" text-anchor="middle">
    <g fill="#000" fill-opacity="0.28" stroke="#000" stroke-opacity="0.17" stroke-width="1.6">
      <text x="0" y="34">THANK YOU</text><text x="430" y="34">THANK YOU</text><text x="860" y="34">THANK YOU</text>
      <text x="0" y="185">THANK YOU</text><text x="430" y="185">THANK YOU</text><text x="860" y="185">THANK YOU</text>
      <text x="0" y="336">THANK YOU</text><text x="430" y="336">THANK YOU</text><text x="860" y="336">THANK YOU</text>
      <text x="0" y="487">THANK YOU</text><text x="430" y="487">THANK YOU</text><text x="860" y="487">THANK YOU</text>
    </g>
    <g fill="#fff" fill-opacity="0.58">
      <text x="0" y="32">THANK YOU</text><text x="430" y="32">THANK YOU</text><text x="860" y="32">THANK YOU</text>
      <text x="0" y="183">THANK YOU</text><text x="430" y="183">THANK YOU</text><text x="860" y="183">THANK YOU</text>
      <text x="0" y="334">THANK YOU</text><text x="430" y="334">THANK YOU</text><text x="860" y="334">THANK YOU</text>
      <text x="0" y="485">THANK YOU</text><text x="430" y="485">THANK YOU</text><text x="860" y="485">THANK YOU</text>
    </g>
  </g>
</svg>`);

async function createWatermarkedDownload(input, contentType) {
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > 30 * 1024 * 1024) {
    throw new Error('Image data exceeds the supported limit.');
  }
  // Auto-orient and keep the uploaded dimensions. No forced resizing.
  const source = sharp(input, { limitInputPixels: 85000000 }).rotate();
  const metadata = await sharp(input).metadata();
  // Sharp requires a tiled overlay no bigger than the input, including small files.
  const tile = Math.min(1, metadata.width / 840, metadata.height / 480);
  const tileBuffer = tile < 1
    ? await sharp(WATERMARK).resize(Math.max(1,Math.floor(840*tile)), Math.max(1,Math.floor(480*tile)), {fit:'fill'}).png().toBuffer()
    : WATERMARK;
  const format = contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp' : 'jpeg';
  const composite = source.composite([{ input: tileBuffer, tile: true, blend:'over' }]);
  if (format === 'png') return { bytes:await composite.png().toBuffer(), contentType:'image/png', ext:'png' };
  if (format === 'webp') return { bytes:await composite.webp({ quality:93 }).toBuffer(), contentType:'image/webp', ext:'webp' };
  return { bytes:await composite.jpeg({ quality:94, chromaSubsampling:'4:4:4' }).toBuffer(), contentType:'image/jpeg', ext:'jpg' };
}

module.exports={createWatermarkedDownload};
