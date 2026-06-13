import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { sceneKey } from "./template-files.js";

const execFileAsync = promisify(execFile);

export interface MogrtScene {
  n: string;
  slug: string;
  aeComp: string;
  previewKey: string;
}

export interface MogrtSceneThumb {
  previewKey: string;
  path: string;
  ext: ".mp4" | ".png";
  contentType: string;
}

export interface MogrtFile {
  slug: string;
  path: string;
}

export interface MogrtExtractResult {
  scenes: MogrtScene[];
  /** R2/disk uchun lokal thumb fayllar — ishlatib bo'lgach cleanup() chaqiring */
  thumbs: MogrtSceneThumb[];
  /** Ajratilgan .mogrt fayllar (selective download uchun R2/diskka saqlanadi) */
  mogrts: MogrtFile[];
  cleanup: () => void;
}

const EMPTY: MogrtExtractResult = {
  scenes: [],
  thumbs: [],
  mogrts: [],
  cleanup: () => {},
};

/** ZIP ichidagi .mogrt entry yo'llarini qaytaradi (macOS axlati filtrlanadi) */
async function listMogrtsInZip(zipPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
      timeout: 15_000,
    });
    return stdout
      .split("\n")
      .map((e) => e.trim())
      .filter(
        (e) =>
          e.toLowerCase().endsWith(".mogrt") &&
          !/(^|\/)__MACOSX\//i.test(e) &&
          !/(?:^|\/)\.\_/.test(e)
      );
  } catch {
    return [];
  }
}

function readDefinitionName(defDir: string): string {
  try {
    const raw = fs.readFileSync(path.join(defDir, "definition.json"), "utf8");
    const def = JSON.parse(raw) as {
      sourceInfoLocalized?: Record<string, { name?: string }>;
      capsuleName?: string;
    };
    const locales = def.sourceInfoLocalized ?? {};
    const loc = locales["en_US"] ?? locales[Object.keys(locales)[0]] ?? {};
    return String(loc.name ?? def.capsuleName ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * ZIP pack ichidagi .mogrt fayllardan sahna ro'yxati + thumb preview'lar.
 * Slug sceneKey formatida (dash, lowercase) — scene serve route va admin
 * adminSceneKey bilan bir xil normalizatsiya. thumbs lokal tmp'da qoladi,
 * chaqiruvchi yuklab bo'lgach cleanup() chaqiradi.
 * unzip yo'q yoki xato bo'lsa bo'sh natija (upload bloklanmaydi).
 */
export async function extractMogrtsFromZip(
  zipPath: string
): Promise<MogrtExtractResult> {
  const entries = await listMogrtsInZip(zipPath);
  if (!entries.length) return EMPTY;

  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_mogrt_"));
  const cleanup = () => {
    try {
      fs.rmSync(rootDir, { recursive: true, force: true });
    } catch {}
  };

  const scenes: MogrtScene[] = [];
  const thumbs: MogrtSceneThumb[] = [];
  const mogrts: MogrtFile[] = [];
  const usedSlugs = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const base = path.basename(entry, ".mogrt");
    let slug = sceneKey(base);
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${sceneKey(base)}-${n}`;
    usedSlugs.add(slug);

    const itemDir = path.join(rootDir, `m${i}`);
    fs.mkdirSync(itemDir, { recursive: true });
    try {
      // Tashqi ZIP dan .mogrt entry ni chiqar (to'liq yo'l bilan)
      await execFileAsync("unzip", ["-o", zipPath, entry, "-d", itemDir], {
        timeout: 60_000,
      });
      const mogrtPath = path.join(itemDir, entry);
      const defDir = path.join(itemDir, "def");
      fs.mkdirSync(defDir);
      try {
        // definition.json + thumb'lar bitta chaqiriqda (-j: yo'lsiz tekis);
        // yo'q a'zo bo'lsa unzip exit!=0 — mavjudlari baribir chiqqan bo'ladi
        await execFileAsync(
          "unzip",
          ["-o", "-j", mogrtPath, "definition.json", "thumb.png", "thumb.mp4", "-d", defDir],
          { timeout: 30_000 }
        );
      } catch {
        /* qisman chiqqan — davom etamiz */
      }
      const name = readDefinitionName(defDir) || base;
      scenes.push({ n: name, slug, aeComp: name, previewKey: slug });
      const mp4 = path.join(defDir, "thumb.mp4");
      const png = path.join(defDir, "thumb.png");
      if (fs.existsSync(mp4))
        thumbs.push({ previewKey: slug, path: mp4, ext: ".mp4", contentType: "video/mp4" });
      if (fs.existsSync(png))
        thumbs.push({ previewKey: slug, path: png, ext: ".png", contentType: "image/png" });
      // .mogrt'ning o'zi selective download uchun saqlanadi — cleanup() o'chiradi
      mogrts.push({ slug, path: mogrtPath });
    } catch {
      scenes.push({ n: base, slug, aeComp: base, previewKey: slug });
    }
  }

  return { scenes, thumbs, mogrts, cleanup };
}
