#!/usr/bin/env node
/**
 * #148 (PX11) — CEP panel ikonalari (GENERATSIYA).
 *
 * MUAMMO: `CSXS/manifest.xml` da `<Icons>` elementi umuman yo'q edi. After Effects
 * "Window → Extensions" ro'yxatida va panel yorlig'ida FrameFlow standart bo'sh ikona
 * bilan chiqardi — boshqa har qanday kengaytmadan farqlanmasdi.
 *
 * YECHIM: ikonalar repo'ga "shunchaki binar" bo'lib tushmaydi — SHU YERDA generatsiya
 * qilinadi. Sabab: (a) manba shakl va rang tokeni kod bilan bir joyda turadi (brend lime
 * `--accent:#d8ff3e`, css/tokens.css), (b) test PNG baytlarini generator chiqishi bilan
 * solishtira oladi (postinstall skriptidagi bilan bir xil naqsh), (c) tashqi rasm asbobi
 * yoki bog'liqlik kerak emas — PNG shu yerda, standart kutubxonasiz yoziladi.
 *
 * Shakl: app-bar'dagi brend belgisi (chaqmoq) — AssetFlow_Plugin.html `#afHomeBtn` svg'si
 * bilan bir xil siluet, 23×23 px (Adobe CEP tavsiyasi) shaffof fonda.
 *
 * Foydalanish:
 *   node scripts/make-panel-icons.mjs write     # icons/ ga yozadi
 *   node scripts/make-panel-icons.mjs check     # diskdagi fayllar generatorga mos-mi
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_SRC = path.resolve(SCRIPTS_DIR, "..");

/** Ikona o'lchami (Adobe CEP panel ikonasi uchun tavsiya etilgan piksel). */
export const ICON_SIZE = 23;

/** Chaqmoq siluети — 24×24 koordinatalarida (brend svg'si bilan bir xil proporsiya). */
const BOLT = [
  [13.2, 1.5],
  [4.4, 13.4],
  [10.9, 13.4],
  [9.8, 22.5],
  [19.6, 10.6],
  [13.1, 10.6],
];

/** CEP `<Icon Type="…">` turlari → fayl nomi va rangi.
 *  Yorug' (Normal/RollOver) va qorong'i (DarkNormal/DarkRollOver) AE mavzulari uchun alohida:
 *  lime `#d8ff3e` yorug' fonda o'qilmaydi, shuning uchun u yerda to'q zaytun ishlatiladi. */
export const PANEL_ICONS = Object.freeze([
  { type: "Normal", file: "icons/panel-normal.png", rgb: [0x4c, 0x6b, 0x00] },
  { type: "RollOver", file: "icons/panel-rollover.png", rgb: [0x33, 0x48, 0x00] },
  { type: "Disabled", file: "icons/panel-disabled.png", rgb: [0x9a, 0x9a, 0x9a] },
  { type: "DarkNormal", file: "icons/panel-dark-normal.png", rgb: [0xd8, 0xff, 0x3e] },
  { type: "DarkRollOver", file: "icons/panel-dark-rollover.png", rgb: [0xea, 0xff, 0x8f] },
]);

// ── Rasterizatsiya ───────────────────────────────────────────────────────────
// 4×4 supersampling bilan qoplama (anti-aliasing). Nuqta-ko'pburchak ichidami — juft/toq
// kesishish qoidasi (siluet oddiy, o'z-o'zini kesmaydi).
const SS = 4;

function inside(px, py) {
  let hit = false;
  for (let i = 0, j = BOLT.length - 1; i < BOLT.length; j = i++) {
    const [xi, yi] = BOLT[i];
    const [xj, yj] = BOLT[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** RGBA piksel buferi (size²·4) — rang bir xil, alfa qoplamadan. */
function rasterize(size, rgb) {
  const scale = 24 / size;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * scale;
          const py = (y + (sy + 0.5) / SS) * scale;
          if (inside(px, py)) hits++;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = Math.round((hits / (SS * SS)) * 255);
    }
  }
  return out;
}

// ── PNG yozuvchi (RGBA8, bitta IDAT — tashqi bog'liqliksiz) ─────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Adler-32 — zlib oqimining yakuniy nazorat summasi. */
function adler32(buf) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * zlib oqimi — SIQILMAGAN ("stored") bloklar bilan, qo'lda.
 *
 * Nega `zlib.deflateSync` EMAS: uning chiqishi zlib kutubxona versiyasiga bog'liq.
 * Ikonalar lokalda (Node 25 / zlib 1.2.x) yozilgan, CI esa Node 22'da yuradi — o'sha
 * baytlar mos kelmadi va "generatordan bayt-ba-bayt bir xil" testi kod to'g'ri bo'la
 * turib qizil bo'ldi. "Stored" blok formatning o'zi bilan belgilanadi → HAR QANDAY
 * Node/zlib'da AYNAN bir xil bayt chiqadi, ya'ni tekshiruv haqiqatan takrorlanadigan.
 * Narxi — ikona ~2KB (siqilganda ~0.2KB); 5 ta fayl uchun ahamiyatsiz.
 */
function storedDeflate(raw) {
  const MAX = 0xffff;
  const parts = [Buffer.from([0x78, 0x01])]; // CMF/FLG (0x7801 % 31 === 0)
  for (let off = 0; off < raw.length || off === 0; off += MAX) {
    const len = Math.min(MAX, raw.length - off);
    const head = Buffer.alloc(5);
    head[0] = off + len >= raw.length ? 1 : 0; // BFINAL, BTYPE=00 (stored)
    head.writeUInt16LE(len, 1);
    head.writeUInt16LE(~len & 0xffff, 3);
    parts.push(head, raw.subarray(off, off + len));
  }
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(adler32(raw));
  parts.push(sum);
  return Buffer.concat(parts);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10,11,12 = deflate / adaptive filter / no interlace (0)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None — deterministik va oddiy
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", storedDeflate(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Bitta ikona baytlari (generator = yagona haqiqat manbai). */
export function panelIconPng(type) {
  const spec = PANEL_ICONS.find((i) => i.type === type);
  if (!spec) throw new Error(`Noma'lum ikona turi: ${type}`);
  return encodePng(ICON_SIZE, rasterize(ICON_SIZE, spec.rgb));
}

/** Diskdagi fayllar generator chiqishiga mos-mi. */
export function checkPanelIcons() {
  return PANEL_ICONS.map((spec) => {
    const file = path.join(PLUGIN_SRC, spec.file);
    const ok = existsSync(file) && readFileSync(file).equals(panelIconPng(spec.type));
    return { ...spec, ok };
  });
}

export function writePanelIcons() {
  mkdirSync(path.join(PLUGIN_SRC, "icons"), { recursive: true });
  for (const spec of PANEL_ICONS) {
    writeFileSync(path.join(PLUGIN_SRC, spec.file), panelIconPng(spec.type));
  }
  return PANEL_ICONS.map((s) => s.file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || "check";
  if (cmd === "write") {
    console.log(writePanelIcons().join("\n"));
  } else if (cmd === "check") {
    const res = checkPanelIcons();
    for (const r of res) console.log(`${r.ok ? "✓" : "✗"} ${r.file}`);
    process.exit(res.every((r) => r.ok) ? 0 : 1);
  } else {
    console.error("Foydalanish: make-panel-icons.mjs write|check");
    process.exit(2);
  }
}
