# SESSION REPORT — 2026-06-19 — V4 Multi-shot storyboard (spec §4)

## Bajarildi — oqim (G1–G5) BUZILMADI (yagona-shot tegmadi)
- **SHOTS bar (video):** `#aiShotLabel` endi video rejimda «SHOTS [1][2]… × +» tablar + Manual/Auto rejim selektori + joriy shot davomiyligi (Auto/1"–10"). Boshqa studio rejim — oddiy «Shot» yorlig'i. `aiRenderShots`.
- **Shot boshqaruvi:** `aiShotAdd` (lazily multi-shot yoqadi: joriy prompt → shot 1, yangi bo'sh shot qo'shadi), `aiShotSwitch` (joriy promptni saqlab, tanlangan shotni yuklaydi), `aiShotRemove` (1 qolsa yagona-shotga qaytadi), `aiShotSetDur`/`aiShotSetMode`. Prompt = joriy shot editori (`aiShotSave`/`aiShotLoad`).
- **Generatsiya:** video + ≥2 shot → `aiRunMultiShot` har shotni KETMA-KET video qiladi (`aiGenOneShot`: session→per-shot quote→/gen→poll, per-shot davomiylik) va AE'ga KETMA-KET import (storyboard). Backend o'zgartirilmadi — mavjud /studio/gen shot bo'yicha aylantiriladi. Yagona-shot oqimi (`aiRunStudioGen`) o'zgarmagan.
- **@mention:** placeholder + biriktirilgan Start reference har shotga uzatiladi (referenceUrl). To'liq @image picker — keyin.
- Kredit: har shot alohida yechiladi/qaytariladi (mavjud atomik oqim), `aiUpdateCredits`/`aiRefreshCredits`.

## Tekshirildi
- Parse: 2 blok, 0 xato. Oqim funksiyalari (aiGenerate/aiRunStudioGen/aiPollJob/aiReferenceDataUri) butun. 3 tema, responsive (SHOTS bar flex-wrap). CEP'ga ko'chirildi (AE qo'zg'atilmadi). studio:sync shart emas.

## Keyingi
- V5 End-frame to'liq wiring (frame_images last_frame) + Add media turlari.
