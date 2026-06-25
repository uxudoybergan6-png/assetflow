# Cowork sessiya — HANDOFF (yangi chatда davom etish uchun)

*Yangilangan: 2026-06-25*

## Ish uslubi (MUHIM)
Foydalanuvchi o'zbekcha tushuntiradi → men (Cowork) **mockup (HTML)** quraman + **Claude Code uchun o'zbekcha promt** yozaman. Claude Code (alohida CLI) plagin/backendни yozadi. Men backendга to'g'ridan tegmayman. Foydalanuvchi Claude Code natijasini menга tashlaydi — men tahlil qilaman.

## Loyiha
AssetFlow — AE CEP plagin + AI Tools (fal.ai). Magnific → fal.ai migratsiya. Incremental: har modelни birma-bir qo'shamiz (foydalanuvchi fal.ai Copy content + Schema yuboradi → men Claude Code promt yozaman → real ulanadi → test).

## Standart / haqiqat manbai
- `docs/AI-TOOL-UI-STANDARD.md` — AI tool UI standarti (composer, bitta qatorли boshqaruv, full-width tugma, yangi funksiya YONIDAN qo'shiladi). HAR tool shunга amal qiladi.
- `docs/FAL-*.md` — fal.ai docs (haqiqat manbai).
- `CLAUDE.md` — loyiha holati.
- Kanonik mockuplar: `design-preview/tool-image.html` (Rasm yaratish), `tool-history.html` (Tarix), `home-mockup.html`.

## BAJARILGAN (real, ishlaydi — AE'da tasdiqlangan)
- **Rasm yaratish** tool — model-aware, **GPT Image 2 Edit** (fal.ai) REAL ishlaydi (referens → R2 → @img1 → natija → import).
- `lib/ai/fal.ts` (queue, Auth Key, CDN→R2, timeout≠refund), gpt-image-2/edit, **Promt yaxshilash** (openrouter/router, Gemini 2.5 Flash).
- Ko'p referens + **@imgN** mapping; referens manbalari: Fayl / Project paneldan / Timeline'dan (CEP `cep_node.require` Node fs; `file://` path normalizatsiya — `toFsPath`).
- Model-aware referens majburiyligi + ogohlantirish banneri + upload spinner.
- Home oyna (Asosiy) + AI Tools launcher.
- FAL_KEY Render env'da bor. Backend deploy: `git push` (GitHub Desktop). Plagin: install-cep (lokal).

## OXIRGI PROMT (Claude Code'ga berilgan, natija KUTILMOQDA)
"Rasm yaratish" ga 4 qo'shimcha (mockuplar tayyor: tool-image.html, tool-history.html):
1. Kompakt layout.
2. **@ dropdown** — @ yozsa referenslar ro'yxati (autocomplete).
3. **Natija kartasi**: ✓ Tanlash / ✕ O'chirish / ↺ Referensga qo'shish.
4. **So'nggi lenta** (Yaratish ostiда, oxirgi ~5) + **Barchasi → Tarix view** (`/api/studio/gen/history`); Tarix: Hammasi/Rasm/Video/Ovoz filtr.

→ Yangi chatда: foydalanuvchidan shu promt natijasini so'ra, tahlil qil.

## KEYINGI
- Yuqoridagi 4 qo'shimcha natijasini tekshirish.
- Keyin yangi modellar (foydalanuvchi fal Copy content + Schema yuboradi): video (i2v/t2v), 3D, ovoz/SFX, va h.k.
- Backlog: Stripe tariflar, Framory rebrand, email bildirishnoma.

## Eslatma
- API kalit = parol. Chatga yozma, commitga qo'yma. Faqat Render env.
- Mockup JS'ni doim `node -e "new Function(script)"` bilan tekshir.
- Mockuplarni `mcp__cowork__present_files` bilan ko'rsat.
