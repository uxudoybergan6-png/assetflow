import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface MogrtScene {
  n: string;
  slug: string;
  aeComp: string;
}

function mogrtSlug(name: string): string {
  return (
    String(name || "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "item"
  );
}

/** ZIP ichidagi .mogrt entry yo'llarini qaytaradi (macOS axlati filtrlanadi) */
function listMogrtsInZip(zipPath: string): string[] {
  try {
    const out = execFileSync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
      timeout: 15_000,
    });
    return out
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
 * ZIP pack ichidagi .mogrt fayllar ro'yxatini qaytaradi.
 * Har bir .mogrt uchun definition.json dan nom o'qiladi.
 * unzip yo'q yoki xato bo'lsa [] qaytarib jim o'tadi (upload bloklanmaydi).
 */
export async function extractMogrtsFromZip(zipPath: string): Promise<MogrtScene[]> {
  const entries = listMogrtsInZip(zipPath);
  if (!entries.length) return [];

  const scenes: MogrtScene[] = [];

  for (const entry of entries) {
    const base = path.basename(entry, ".mogrt");
    const slug = mogrtSlug(base);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "af_mogrt_"));
    try {
      // Tashqi ZIP dan .mogrt entry ni tmp ga chiqar (to'liq yo'l bilan)
      execFileSync("unzip", ["-o", zipPath, entry, "-d", tmpDir], {
        timeout: 30_000,
      });
      const mogrtPath = path.join(tmpDir, entry);
      // .mogrt ichidan faqat definition.json ni chiqar (-j: yo'lsiz tekis)
      const defDir = path.join(tmpDir, "def");
      fs.mkdirSync(defDir);
      try {
        execFileSync(
          "unzip",
          ["-o", "-j", mogrtPath, "definition.json", "-d", defDir],
          { timeout: 15_000 }
        );
      } catch {
        // definition.json yo'q — fayl nomidan foydalanamiz
      }
      const name = readDefinitionName(defDir) || base;
      scenes.push({ n: name, slug, aeComp: name });
    } catch {
      scenes.push({ n: base, slug, aeComp: base });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  return scenes;
}
