/**
 * `pm2 jlist` stdout'ini bardoshli o'qish.
 *
 * Nega kerak: PM2 CLI chiqishida HAR DOIM toza JSON bo'lmaydi. Xotiradagi (ishlab turgan)
 * daemon CLI'dan eski bo'lsa — masalan pm2 6 → 7 yangilanishidan KEYIN, foydalanuvchi hali
 * `pm2 kill`/`npm run pm2:reset` qilmagan bo'lsa — PM2 JSON massividan OLDIN banner chiqaradi:
 *
 *   >>>> In-memory PM2 is out-of-date, do:
 *   >>>> $ pm2 update
 *   In memory PM2 version: 6.0.14
 *   Local PM2 version: 7.0.3
 *
 *   [{"pid":…}]
 *
 * Ikkinchi holat (LOKAL TASDIQLANGAN, pm2 7.0.3): daemon umuman ishlamayotgan bo'lsa
 * (`pm2 kill` / `npm run pm2:reset` dan keyin, yoki yangi mashinada) `pm2 jlist` JSON'dan
 * oldin ASCII banner + KVADRAT QAVSLI qatorlar chiqaradi:
 *
 *   [PM2] Spawning PM2 daemon with pm2_home=/Users/…/.pm2
 *   [PM2] PM2 Successfully daemonized
 *   []
 *
 * Shu sabab "birinchi `[` dan boshlab o'qish" YETARLI EMAS — u `[PM2]` ga tushadi. Nomzod
 * `[` o'rinlarini navbat bilan sinaymiz va TO'LIQ JSON massivga aylanadigan birinchisini
 * olamiz (JSON.parse butun qoldiqni yeyishi shart, shu sabab ichki massivga tushib ketmaydi).
 *
 * @param {string} stdout
 * @returns {Array|null} jarayonlar ro'yxati yoki null (o'qib bo'lmadi)
 */
export function parsePm2Jlist(stdout) {
  const s = String(stdout ?? "");
  // Banner nomzodlari kam (pm2 7 da 2 ta) — cheklov faqat pathologik kirishga qarshi.
  const MAX_CANDIDATES = 32;
  let from = 0;
  for (let i = 0; i < MAX_CANDIDATES; i++) {
    const start = s.indexOf("[", from);
    if (start < 0) return null;
    try {
      const list = JSON.parse(s.slice(start).trim());
      if (Array.isArray(list)) return list;
    } catch {
      /* keyingi nomzodni sinaymiz */
    }
    from = start + 1;
  }
  return null;
}
