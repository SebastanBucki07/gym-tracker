const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function generateIcon(size, isMaskable = false) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowSize);

  // Center coordinate
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Default background color: deep blue-gray / brand gradient
      let red = 15;
      let green = 23;
      let blue = 42;
      let alpha = 255;

      // Circle rounded background for non-maskable or safe area
      if (!isMaskable && dist > 0.98) {
        alpha = 0;
      } else {
        // Gradient inner circle
        if (dist <= 0.85) {
          // #007bff to #0056b3 gradient
          const gradFactor = (ny + 1) / 2;
          red = Math.round(0 * (1 - gradFactor) + 0 * gradFactor);
          green = Math.round(123 * (1 - gradFactor) + 86 * gradFactor);
          blue = Math.round(255 * (1 - gradFactor) + 179 * gradFactor);
        }

        // Draw Dumbbell emblem in center (white)
        // Horizontal bar: |nx| < 0.45 and |ny| < 0.08
        // Plates: |nx| between 0.35 and 0.5, |ny| < 0.32
        // Inner plates: |nx| between 0.22 and 0.35, |ny| < 0.22
        const isBar = Math.abs(nx) <= 0.45 && Math.abs(ny) <= 0.06;
        const isOuterPlate = Math.abs(nx) >= 0.34 && Math.abs(nx) <= 0.46 && Math.abs(ny) <= 0.30;
        const isInnerPlate = Math.abs(nx) >= 0.22 && Math.abs(nx) <= 0.32 && Math.abs(ny) <= 0.22;
        const isCenterGrip = Math.abs(nx) <= 0.12 && Math.abs(ny) <= 0.08;

        if (isBar || isOuterPlate || isInnerPlate || isCenterGrip) {
          red = 255;
          green = 255;
          blue = 255;
        }
      }

      rawData[px] = red;
      rawData[px + 1] = green;
      rawData[px + 2] = blue;
      rawData[px + 3] = alpha;
    }
  }

  const idat = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), idat, iend]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of sizes) {
  const buf = generateIcon(s, false);
  fs.writeFileSync(path.join(outDir, `icon-${s}x${s}.png`), buf);
}

// Maskable icons
fs.writeFileSync(path.join(outDir, 'icon-maskable-192x192.png'), generateIcon(192, true));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512x512.png'), generateIcon(512, true));

console.log('All PWA icons generated successfully in', outDir);
