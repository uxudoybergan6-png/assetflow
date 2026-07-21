// P11 — plagin versiya/reliz kontrakti (GET /api/plugin/version). Pure funksiyalar —
// route DB/S3'dan chaqiradi, bu yerda faqat hisob-kitob (sinov uchun izolyatsiya qilingan).
//
// Task 2 (2026-07-22): panel o'zini o'zi ustiga yozadigan ZXP self-updater BEKOR qilindi.
// Yangi kontrakt — PLATFORMAGA XOS INSTALLER artefakti: panel faylni yuklab oladi,
// SHA-256'ni MAJBURIY tekshiradi va OS installeriga topshiradi (o'zi hech narsa
// o'rnatmaydi). Ishonch chegarasi — OS installeri. Batafsil: docs/PLUGIN-UPDATE-CHAIN.md.

export function semverParts(v: string): number[] {
  return String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
}

export function semverLt(a: string, b: string): boolean {
  const pa = semverParts(a), pb = semverParts(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

/** LEGACY reliz paketi kaliti (`releases/...`) haqiqiy .zxp fayl bo'lishi SHART — zip yoki
 *  boshqa arbitrar fayl plagin relizi sifatida e'lon qilinmasin. Kengaytma tekshiruvi
 *  registrga sezgir emas (`.ZXP` ham qabul qilinadi).
 *  ⚠️ .zxp endi FAQAT qo'lda yuklab olish uchun (veb sahifa) — panel uni HECH QACHON
 *  avtomatik o'rnatmaydi. Avtomatik yangilanish faqat `installers` orqali. */
export function isZxpReleaseKey(key: string): boolean {
  return /\.zxp$/i.test(String(key || "").trim());
}

// ── Platformaga xos installer kontrakti ────────────────────────────────────
// Allowlist QATTIQ: mac faqat .pkg (macOS Installer), win faqat .exe/.msi
// (imzolangan installer / Windows Installer). Boshqasi — halol rad javob.

export type InstallerPlatform = "mac" | "win";

export const INSTALLER_PLATFORMS: readonly InstallerPlatform[] = ["mac", "win"];

export const INSTALLER_EXTENSIONS: Record<InstallerPlatform, readonly string[]> = {
  mac: ["pkg"],
  win: ["exe", "msi"],
};

export const INSTALLER_LABEL: Record<InstallerPlatform, string> = {
  mac: "macOS",
  win: "Windows",
};

/** `installerStatus` — klient uchun HALOL sabab (jim qolish yo'q). */
export type InstallerStatus =
  | "ok"
  | "unsupported_platform" // OS aniqlanmadi yoki allowlist'da yo'q (masalan Linux)
  | "not_published"        // bu platforma uchun artefakt hali e'lon qilinmagan
  | "storage_unavailable"; // artefakt bor, lekin havola hozir berilmayapti

/** Klient/UA bergan xom qiymatni allowlist platformasiga keltiradi. Noma'lum → null. */
export function normalizeInstallerPlatform(raw: unknown): InstallerPlatform | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "mac" || v === "macos" || v === "darwin" || v === "osx" || v === "mac-os") return "mac";
  if (v === "win" || v === "win32" || v === "win64" || v === "windows") return "win";
  return null;
}

/** Brauzer uchun zaxira aniqlash (veb yuklab olish sahifasi). Panel HAR DOIM aniq
 *  `platform=` yuboradi — UA faqat brauzer uchun. Aniqlanmasa null (halol "qo'lda tanlang"). */
export function detectPlatformFromUserAgent(ua: unknown): InstallerPlatform | null {
  const s = String(ua ?? "");
  if (/Windows NT|Win64|WOW64/i.test(s)) return "win";
  // iPhone/iPad — macOS EMAS: plagin ular uchun mavjud emas.
  if (/iPhone|iPad|iPod|Android/i.test(s)) return null;
  if (/Mac OS X|Macintosh/i.test(s)) return "mac";
  return null;
}

/** Aniq (explicit) parametr ustun; bo'lmasa UA. Ikkalasi ham bermasa null. */
export function resolveInstallerPlatform(
  explicit: unknown,
  userAgent?: unknown
): { platform: InstallerPlatform | null; source: "explicit" | "user-agent" | "none" } {
  const raw = String(explicit ?? "").trim();
  if (raw) {
    const p = normalizeInstallerPlatform(raw);
    // Aniq berilgan lekin allowlist'da yo'q → UA bilan "tuzatib" yubormaymiz (halol rad).
    return { platform: p, source: "explicit" };
  }
  const p = detectPlatformFromUserAgent(userAgent);
  return { platform: p, source: p ? "user-agent" : "none" };
}

/** SHA-256 — aynan 64 hex belgi (registr aralash bo'lishi mumkin). Bo'sh/qisqa/uzun = rad. */
export function isSha256Hex(v: unknown): boolean {
  return /^[0-9a-fA-F]{64}$/.test(String(v ?? ""));
}

/** Kalitning oxirgi kengaytmasi (nuqtasiz, kichik harf). Yo'q bo'lsa null. */
export function installerExtension(key: unknown): string | null {
  const s = String(key ?? "").trim();
  const m = /\.([A-Za-z0-9]+)$/.exec(s);
  return m ? m[1].toLowerCase() : null;
}

/** Storage kaliti installer sifatida qabul qilinishi mumkinmi:
 *  `releases/` ostida · traversal/absolut yo'q · kengaytma SHU platforma allowlist'ida. */
export function isAllowedInstallerKey(platform: unknown, key: unknown): boolean {
  const p = normalizeInstallerPlatform(platform);
  if (!p) return false;
  const s = String(key ?? "").trim();
  if (!s || s !== String(key ?? "")) return false;         // bo'sh yoki chetida bo'shliq
  if (!s.startsWith("releases/")) return false;
  if (s.includes("..") || s.includes("\\") || s.includes("//")) return false;
  if (/[\x00-\x1f]/.test(s)) return false;
  const ext = installerExtension(s);
  return !!ext && INSTALLER_EXTENSIONS[p].indexOf(ext) >= 0;
}

/** Foydalanuvchiga ko'rinadigan (va diskka yoziladigan) XAVFSIZ fayl nomi —
 *  serverdagi kalitdan EMAS, versiya+kengaytmadan quriladi (traversal imkonsiz). */
export function installerFileName(version: unknown, platform: unknown, ext: unknown): string {
  const v = String(version ?? "").replace(/[^0-9A-Za-z.\-]/g, "");
  const p = normalizeInstallerPlatform(platform);
  const e = String(ext ?? "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return `frameflow-plugin-${v || "update"}-${p || "unknown"}.${e || "bin"}`;
}

/** Admin publish uchun bitta installer yozuvining to'liq tekshiruvi (fail-closed).
 *  Route shu funksiyadan foydalanadi — testlar HAQIQIY qoidani sinaydi. */
export function validateInstallerInput(input: {
  platform?: unknown;
  key?: unknown;
  sha256?: unknown;
}): { ok: true; platform: InstallerPlatform; key: string; sha256: string; ext: string } | { ok: false; error: string } {
  const platform = normalizeInstallerPlatform(input.platform);
  if (!platform) return { ok: false, error: "Installer platform must be mac or win" };
  if (!isAllowedInstallerKey(platform, input.key)) {
    return {
      ok: false,
      error: `Installer for ${INSTALLER_LABEL[platform]} must be a key under releases/ ending in ${INSTALLER_EXTENSIONS[platform]
        .map((e) => "." + e)
        .join(" or ")}`,
    };
  }
  if (!isSha256Hex(input.sha256)) {
    return { ok: false, error: "Installer SHA-256 must be exactly 64 hex characters" };
  }
  const key = String(input.key);
  return { ok: true, platform, key, sha256: String(input.sha256).toLowerCase(), ext: installerExtension(key)! };
}

/** Faqat https artefakt havolasi qabul qilinadi (panel ham shuni talab qiladi). */
export function isHttpsUrl(u: unknown): boolean {
  return /^https:\/\/[^\s]+$/i.test(String(u ?? ""));
}

// ── LEGACY .zxp o'chirish kaliti (kill switch) ─────────────────────────────
// ff10d51'gacha bo'lgan panel `platform=` YUBORMAYDI va javobdagi `downloadUrl`ni
// ko'rsa arxivni ochib O'ZINING jonli extension papkasi ustiga yozadi. O'sha eski
// klientlar hali o'rnatilgan bo'lishi mumkin — shu bois legacy havola endi FAQAT
// aniq `manual=1` opt-in bilan (veb sahifadagi qo'lda yuklab olish) qaytariladi.
// Opt-in YO'Q => `downloadUrl: null` => eski klientda xavfli yo'l umuman ishga
// tushmaydi. Yangi panel bu maydonni baribar e'tiborsiz qoldiradi.

/** Aniq (explicit) qo'lda yuklab olish opt-in'i. Allowlist QATTIQ: faqat shu
 *  qiymatlar. Yo'q/bo'sh/massiv/boshqa har qanday qiymat = opt-in YO'Q (fail-closed). */
export function isManualDownloadRequest(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Javobga tushadigan legacy havola — opt-in bo'lmasa HAR DOIM null.
 *  Route AYNAN shu funksiyadan o'tkazadi (yagona chiqish nuqtasi). */
export function resolveLegacyDownloadUrl(manualParam: unknown, signedUrl: string | null): string | null {
  if (!isManualDownloadRequest(manualParam)) return null;
  return signedUrl || null;
}

export interface PluginInstallerRow {
  platform: string;
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

/** Ommaviy javobga tushadigan yagona installer bloki — storage kaliti YO'Q. */
export interface InstallerPayload {
  platform: InstallerPlatform;
  ext: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  url: string;
}

/** So'ralgan platformaga MOS bitta qatorni tanlaydi (boshqa platformalar javobga
 *  umuman chiqmaydi). Yaroqsiz/nomuvofiq qator — yo'q deb hisoblanadi (fail-closed). */
export function selectInstallerRow(
  rows: PluginInstallerRow[] | null | undefined,
  platform: InstallerPlatform | null
): PluginInstallerRow | null {
  if (!platform || !Array.isArray(rows)) return null;
  for (const r of rows) {
    if (!r) continue;
    if (normalizeInstallerPlatform(r.platform) !== platform) continue;
    if (!isAllowedInstallerKey(platform, r.storageKey)) continue;
    if (!isSha256Hex(r.sha256)) continue;
    if (!(Number(r.sizeBytes) > 0)) continue;
    return r;
  }
  return null;
}

/** Tanlangan qator + imzolangan havoladan ommaviy payload. Havola https bo'lmasa —
 *  null (klient hech qachon http artefaktni ochmasin). */
export function buildInstallerPayload(
  version: string,
  row: PluginInstallerRow | null,
  url: string | null
): InstallerPayload | null {
  if (!row || !url || !isHttpsUrl(url)) return null;
  const platform = normalizeInstallerPlatform(row.platform);
  const ext = installerExtension(row.storageKey);
  if (!platform || !ext) return null;
  return {
    platform,
    ext,
    fileName: installerFileName(version, platform, ext),
    sizeBytes: Number(row.sizeBytes),
    sha256: String(row.sha256).toLowerCase(),
    url,
  };
}

export interface PluginReleaseRow {
  version: string;
  releaseNotes: string | null;
  publishedAt: Date;
  checksum: string | null;
  mandatory: boolean;
  minSupportedVersion: string | null;
}

export interface PluginVersionResponse {
  latest: { version: string; releaseNotes: string; publishedAt: Date; checksum: string | null } | null;
  updateAvailable: boolean;
  mandatory: boolean;
  downloadUrl: string | null;
  platform: InstallerPlatform | null;
  installer: InstallerPayload | null;
  installerStatus: InstallerStatus;
}

export interface InstallerContext {
  platform: InstallerPlatform | null;
  installer: InstallerPayload | null;
  status: InstallerStatus;
}

/** current = klient hozirgi versiyasi ("" = noma'lum/birinchi tekshiruv).
 *  latest = so'nggi e'lon qilingan reliz (null = HALI HECH NARSA nashr etilmagan — beta chiqmagan).
 *  downloadUrl = LEGACY .zxp presigned havolasi — route uni `resolveLegacyDownloadUrl`
 *    orqali beradi, ya'ni faqat aniq `manual=1` so'rovida (veb sahifadagi qo'lda yuklab
 *    olish). Opt-in bo'lmasa null — eski self-overwrite klientlari uchun kill switch.
 *  installerCtx = platformaga xos installer (yo'q bo'lsa halol status bilan). */
export function computePluginVersionResponse(
  current: string,
  latest: PluginReleaseRow | null,
  downloadUrl: string | null,
  installerCtx?: InstallerContext
): PluginVersionResponse {
  const ctx: InstallerContext = installerCtx ?? {
    platform: null,
    installer: null,
    status: latest ? "unsupported_platform" : "not_published",
  };
  // Fail-closed: status "ok" faqat haqiqiy payload bilan birga bo'lishi mumkin.
  const installer = ctx.status === "ok" ? ctx.installer : null;
  const installerStatus: InstallerStatus = installer ? "ok" : ctx.status === "ok" ? "not_published" : ctx.status;
  if (!latest) {
    return {
      latest: null,
      updateAvailable: false,
      mandatory: false,
      downloadUrl: null,
      platform: ctx.platform,
      installer: null,
      installerStatus: ctx.platform ? "not_published" : "unsupported_platform",
    };
  }
  const updateAvailable = !!current && semverLt(current, latest.version);
  // Majburiy: reliz mandatory deb belgilangan YOKI klient minSupportedVersion'dan past
  const mandatory =
    updateAvailable &&
    (latest.mandatory || (!!latest.minSupportedVersion && !!current && semverLt(current, latest.minSupportedVersion)));
  return {
    latest: {
      version: latest.version,
      releaseNotes: latest.releaseNotes || "",
      publishedAt: latest.publishedAt,
      checksum: latest.checksum || null,
    },
    updateAvailable,
    mandatory,
    downloadUrl,
    platform: ctx.platform,
    installer,
    installerStatus,
  };
}
