# SESSION-REPORT — R4_07 (Topaz catalog: enhance/upscale ops) 2026-07-20

**Qilindi (1 commit, push YO'Q):**
- 3 Topaz OP katalogga qo'shildi (opType — composer picker'idan filtrlangan, generativ model EMAS):
  5001 Upscale Video (Proteus, prob-4), 5002 Upscale Image (Gigapixel Standard V2), 5003 Remove BG.
- Narx (margin rule, TOPAZ_USD_PER_CREDIT env def $0.10): image op 11 kr; Proteus perSec 720p/1080p/4k = 3/5/17.
- provider-cost.ts: 5001 VIDEO_USD_PER_SEC + 5002/5003 IMAGE_USD_PER_UNIT (Topaz-cr×tier).
- runTopazImage endpoint/model deskriptordan; runTopazVideo sourceKey→external R2 URL + output geometry.
- /gen/models opType filtri; verify-gen-payloads.mjs ops bo'limi + 429-retry; scripts/probe-topaz-ops.mjs.

**Topilgan (jonli probe, obuna FAOL):**
- Gigapixel E2E PASS (credits=1) · Proteus video TO'LIQ lifecycle E2E PASS · RemoveBG 3/3 FAIL
  (submit OK+1cr rezerv, /matting job "Failed") → 5003 enabled:false.

**Natija:** build PASS (51 entry, 24 yoqilgan) · boot pricing-floor PASS · verify ALL PASS ·
ops composer'da KO'RINMAYDI · money-zone TEGILMAGAN (control Nano Banana 2 = 4/64 o'zgarmadi).

**OWNER ACTION:** Topaz plan'ida "Matting / Background Removal"ni yoqing (yoki support) → 5003 enabled:true.
