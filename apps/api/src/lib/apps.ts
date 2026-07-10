/**
 * FAZA 5 (KONTENT-QUVURI-SXEMA.md §2, §11) — kanonik ko'p-dastur konfiguratsiyasi.
 *
 * YAGONA MANBA: API shu ro'yxatga tayanadi; plagin va platforma esa mos ko'chirma
 * nusxa saqlaydi (klient literallar shu yerdagi kod/label/rang/kengaytmalar bilan bir
 * xil bo'lishi shart). Har shablon bitta dastur uchun, tabiiy formatda.
 *
 * Kod → { label, fullName, packExts, colorHint }.
 *   ae      After Effects   .aep .aet          (zip ichida — server .zip'ni ham qabul qiladi)
 *   pr      Premiere Pro    .mogrt .prproj
 *   motion  Apple Motion    .motn .moti
 *   resolve DaVinci Resolve .drfx .dra .setting
 *
 * TODO(FF): kengaytmalarni jonli shablon bilan tasdiqlash — .aep/.mogrt aniq, ammo
 * Apple Motion (.moti) va DaVinci (.dra/.setting) variantlarini haqiqiy eksport bilan
 * tekshirish kerak. Aniq loyiha kengaytmasi (.aep/.mogrt/.motn/.drfx) ishonchli.
 */
export interface AppConfig {
  /** Karta rozetkasi qisqa yorlig'i (Ae/Pr/Mn/Dr). */
  label: string;
  /** To'liq nom (detal ekranida, CTA'da). */
  fullName: string;
  /** Zip ichidan qidiriladigan pack kengaytmalari (kichik harf, nuqta bilan). */
  packExts: string[];
  /** Rozetka nuqta rangi (klient nusxalari bilan mos). */
  colorHint: string;
}

export const APP_CONFIG: Record<string, AppConfig> = {
  ae: { label: "Ae", fullName: "After Effects", packExts: [".aep", ".aet", ".ffx"], colorHint: "#b794f6" },
  pr: { label: "Pr", fullName: "Premiere Pro", packExts: [".mogrt", ".prproj"], colorHint: "#7aa2f7" },
  motion: { label: "Mn", fullName: "Apple Motion", packExts: [".motn", ".moti"], colorHint: "#5cc8b0" },
  resolve: { label: "Dr", fullName: "DaVinci Resolve", packExts: [".drfx", ".dra", ".setting"], colorHint: "#f0907f" },
};

/** templateApp ustuni default qiymati (schema.prisma bilan mos) — dastur belgilanmagan eski shablonlar AE. */
export const DEFAULT_APP = "ae";

/** Kengaytma (kichik harf, nuqta bilan) → dastur kodi. */
export const PACK_EXT_APP: Record<string, string> = Object.fromEntries(
  Object.entries(APP_CONFIG).flatMap(([code, cfg]) => cfg.packExts.map((ext) => [ext, code]))
);

/** Kengaytmadan dastur kodini aniqlaydi. Noma'lum format bo'lsa null. */
export function appForPackExt(ext: string | null | undefined): string | null {
  return PACK_EXT_APP[String(ext || "").toLowerCase()] || null;
}

/** Berilgan kod haqiqiy dasturmi. */
export function isKnownApp(code: string | null | undefined): boolean {
  return !!code && Object.prototype.hasOwnProperty.call(APP_CONFIG, String(code).toLowerCase());
}
