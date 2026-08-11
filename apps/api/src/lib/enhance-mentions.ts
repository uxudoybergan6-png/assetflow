// P28.3 — Enhance @mention BUTUNLIGI tekshiruvi.
//
// Enhance (LLM) prompt'ni qayta yozganda @Image N / @video N / @audio N tokenlarini AYNAN
// saqlashi shart — ular modelning referenslarga BOG'LANISHI. LLM `@Image 5` o'rniga `@Image 3`
// qaytarsa (renumber) yoki kirishda YO'Q mention qo'shsa — generatsiya NOTO'G'RI rasmga ishora
// qiladi va foydalanuvchi buni sezmaydi. Shuning uchun: chiqishdagi HAR mention kirishda YOKI
// so'rovga haqiqatan biriktirilgan referenslar ichida BO'LISHI shart (kind+raqam bo'yicha).
// Aks holda qayta yozish RAD ETILADI, asl prompt qoldiriladi (jimgina "tuzatib" qo'yilmaydi —
// bu boshqa rasmga ishora qilardi).

export type MentionKey = string; // "image:1" | "video:2" | "audio:1" | "start" | "end"

/** Prompt matnidan @mention'larni normallashtirilgan kalitlar to'plamiga ajratadi.
 *  @Image 1 / @img1 / @image1 → "image:1"; @video2 → "video:2"; @start → "start". */
export function parseMentionKeys(text: string): Set<MentionKey> {
  const out = new Set<MentionKey>();
  const src = String(text || "");
  // @start / @end (raqamsiz rol slotlari)
  const roleRe = /@(start|end)\b/gi;
  let rm: RegExpExecArray | null;
  while ((rm = roleRe.exec(src))) out.add(rm[1].toLowerCase());
  // @img/@image/@video/@vid/@audio/@aud + ixtiyoriy bo'shliq + raqam
  const numRe = /@(image|img|video|vid|audio|aud)\s*(\d+)/gi;
  let nm: RegExpExecArray | null;
  while ((nm = numRe.exec(src))) {
    const raw = nm[1].toLowerCase();
    const kind = raw === "img" ? "image" : raw === "vid" ? "video" : raw === "aud" ? "audio" : raw;
    out.add(`${kind}:${Number(nm[2])}`);
  }
  return out;
}

/**
 * Chiqish prompti kirishdagi mention'larni AYNAN saqlaydimi?
 * `allowedAdditions` — promptda yozilmagan, lekin so'rovga haqiqatan biriktirilgan slotlar. Vision
 * Enhance ularni qonuniy ravishda tilga olishi mumkin (masalan, tile bor, promptda @img1 yo'q).
 * ok=false → mavjud bo'lmagan mention qo'shilgan, qayta raqamlangan YOKI kirish mentioni tushirilgan.
 */
export function validateMentionIntegrity(
  input: string,
  output: string,
  allowedAdditions: Iterable<MentionKey> = []
): { ok: true } | { ok: false; extraneous: MentionKey[]; missing: MentionKey[] } {
  const inKeys = parseMentionKeys(input);
  const outKeys = parseMentionKeys(output);
  const allowedKeys = new Set(allowedAdditions);
  const extraneous: MentionKey[] = [];
  const missing: MentionKey[] = [];
  for (const k of outKeys) if (!inKeys.has(k) && !allowedKeys.has(k)) extraneous.push(k);
  for (const k of inKeys) if (!outKeys.has(k)) missing.push(k);
  return extraneous.length || missing.length ? { ok: false, extraneous, missing } : { ok: true };
}
