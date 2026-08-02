#!/usr/bin/env node
/*
 * UXP plagin ikonkalarini generatsiya qiladi (PNG, tashqi kutubxonasiz).
 * Adobe UXP ikonkani `<nom>@1x.png` / `<nom>@2x.png` naqshi bilan qidiradi,
 * manifestda esa suffiksiz yo'l yoziladi: "icons/ff23.png".
 *
 * Foydalanish: node plugins/premiere-uxp/scripts/make-icons.mjs <chiqish-papkasi>
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve(process.argv[2] || "plugins/premiere-uxp/icons");
fs.mkdirSync(outDir, { recursive: true });

const LIME = [200, 242, 76]; // #c8f24c — brend acid-lime
const INK = [17, 19, 15]; //  #11130f — brend noir

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

/** RGBA piksel matritsasidan PNG buferi yasaydi. */
function png(size, pixelAt) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** FrameFlow nishoni: lime yumaloq kvadrat + ichida noir "F" shakli. */
function frameflowIcon(size) {
  const r = Math.max(2, Math.round(size * 0.22));
  const inside = (x, y) => {
    const dx = Math.min(x, size - 1 - x);
    const dy = Math.min(y, size - 1 - y);
    if (dx >= r || dy >= r) return true;
    const cx = r - dx;
    const cy = r - dy;
    return cx * cx + cy * cy <= r * r;
  };
  // "F" harfi: vertikal ustun + ikki gorizontal shtrix.
  const t = Math.max(1, Math.round(size * 0.14)); // shtrix qalinligi
  const x0 = Math.round(size * 0.3);
  const y0 = Math.round(size * 0.24);
  const y1 = Math.round(size * 0.76);
  const glyph = (x, y) => {
    if (y < y0 || y > y1) return false;
    if (x >= x0 && x < x0 + t) return true; // ustun
    if (y >= y0 && y < y0 + t && x < Math.round(size * 0.74)) return true; // yuqori shtrix
    const my = Math.round(size * 0.46);
    if (y >= my && y < my + t && x < Math.round(size * 0.64)) return true; // o'rta shtrix
    return false;
  };
  return png(size, (x, y) => {
    if (!inside(x, y)) return [0, 0, 0, 0];
    if (glyph(x, y)) return [INK[0], INK[1], INK[2], 255];
    return [LIME[0], LIME[1], LIME[2], 255];
  });
}

for (const base of [23, 48]) {
  fs.writeFileSync(path.join(outDir, `ff${base}@1x.png`), frameflowIcon(base));
  fs.writeFileSync(path.join(outDir, `ff${base}@2x.png`), frameflowIcon(base * 2));
}
console.log(`Ikonkalar yozildi: ${outDir} (ff23@1x/@2x, ff48@1x/@2x)`);
