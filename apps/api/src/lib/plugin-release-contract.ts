// P11 — plagin versiya/reliz kontrakti (GET /api/plugin/version). Pure funksiyalar —
// route DB/S3'dan chaqiradi, bu yerda faqat hisob-kitob (sinov uchun izolyatsiya qilingan).

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
}

/** current = klient hozirgi versiyasi ("" = noma'lum/birinchi tekshiruv).
 *  latest = so'nggi e'lon qilingan reliz (null = HALI HECH NARSA nashr etilmagan — beta chiqmagan).
 *  downloadUrl = chaqiruvchi tomonidan hisoblangan presigned havola (yoki storage tayyor bo'lmasa null). */
export function computePluginVersionResponse(
  current: string,
  latest: PluginReleaseRow | null,
  downloadUrl: string | null
): PluginVersionResponse {
  if (!latest) {
    return { latest: null, updateAvailable: false, mandatory: false, downloadUrl: null };
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
  };
}
