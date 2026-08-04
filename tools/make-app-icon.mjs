/**
 * Generate the app icon (build/icon.png, 1024×1024) — a Sirius blue-white star
 * on a deep-navy square (macOS/Windows/Linux apply their own masking). No asset
 * files needed; electron-builder derives the platform icons from this PNG.
 *
 * Run: npm run make-icon
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZE = 1024;
const SS = 2; // supersample factor for anti-aliasing
const BIG = SIZE * SS;

const BG = [10, 14, 32]; // #0a0e20
const STAR = [122, 184, 255]; // blue-white

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y += 1) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- star geometry ---
const cx = BIG / 2;
const cy = BIG / 2;
const outer = BIG * 0.4;
const inner = outer * 0.42;
const pts = [];
for (let i = 0; i < 10; i += 1) {
  const r = i % 2 === 0 ? outer : inner;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
}
function inStar(px, py) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Render at BIG, then downscale by averaging SS×SS blocks (anti-aliasing).
const big = Buffer.alloc(BIG * BIG * 4);
for (let y = 0; y < BIG; y += 1) {
  for (let x = 0; x < BIG; x += 1) {
    const o = (y * BIG + x) * 4;
    const c = inStar(x + 0.5, y + 0.5) ? STAR : BG;
    big[o] = c[0];
    big[o + 1] = c[1];
    big[o + 2] = c[2];
    big[o + 3] = 255;
  }
}
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const o = ((y * SS + sy) * BIG + (x * SS + sx)) * 4;
        r += big[o];
        g += big[o + 1];
        b += big[o + 2];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = 255;
  }
}

mkdirSync('build', { recursive: true });
writeFileSync('build/icon.png', encodePng(SIZE, SIZE, out));
console.log('wrote build/icon.png');
