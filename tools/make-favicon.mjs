/**
 * Generate the web favicon (public/favicon.ico) — the same Sirius blue-white
 * star used for the app icon (see make-app-icon.mjs), rasterized at the
 * favicon sizes browsers actually request (16/32/48) and packed into a single
 * multi-resolution .ico. No asset files or deps needed.
 *
 * Run: npm run make-favicon
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZES = [16, 32, 48];
const SS = 8; // supersample factor for anti-aliasing (small sizes need more)

const BG = [10, 14, 32]; // #0a0e20
const STAR = [122, 184, 255]; // blue-white

// --- minimal PNG encoder (same approach as make-app-icon.mjs) ---
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

// --- star geometry (rendered per-size, supersampled then downscaled) ---
function renderStarPng(size) {
  const big = size * SS;
  const cx = big / 2;
  const cy = big / 2;
  const outer = big * 0.4;
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

  const buf = Buffer.alloc(big * big * 4);
  for (let y = 0; y < big; y += 1) {
    for (let x = 0; x < big; x += 1) {
      const o = (y * big + x) * 4;
      const c = inStar(x + 0.5, y + 0.5) ? STAR : BG;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const o = ((y * SS + sy) * big + (x * SS + sx)) * 4;
          r += buf[o];
          g += buf[o + 1];
          b += buf[o + 2];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return encodePng(size, size, out);
}

// --- ICO container: modern format embeds PNG-compressed frames directly ---
function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const datas = [];
  images.forEach(({ size, png }, i) => {
    const e = i * 16;
    entries[e] = size >= 256 ? 0 : size; // width
    entries[e + 1] = size >= 256 ? 0 : size; // height
    entries[e + 2] = 0; // color count
    entries[e + 3] = 0; // reserved
    entries.writeUInt16LE(1, e + 4); // planes
    entries.writeUInt16LE(32, e + 6); // bit count
    entries.writeUInt32LE(png.length, e + 8); // bytes in resource
    entries.writeUInt32LE(offset, e + 12); // image offset
    offset += png.length;
    datas.push(png);
  });
  return Buffer.concat([header, entries, ...datas]);
}

const images = SIZES.map((size) => ({ size, png: renderStarPng(size) }));
mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.ico', encodeIco(images));
console.log('wrote public/favicon.ico');
