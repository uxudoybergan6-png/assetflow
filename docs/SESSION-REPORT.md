# SESSION-REPORT — Landing HERO Variant A + `?hero=` A/B toggle (2026-07-05)

**Nima qilindi** (faqat `packages/assetflow-studio/platform/index.html`, additive ~147 qator):
1. **HERO A «Jonli studiya»** — `_landing-rich-mockup.html` Variant A'dan 1:1 port (ffl- scoped): aurora/mesh + gridbg, 64px gradient sarlavha, jonli AI Studio media-panel (JONLI indikator, rail Rasm/Video/Ovoz/SFX + KREDIT, resgrid, playing VIDEO EQ+progress, yozilayotgan composer + chip/cost/send). Verbatim hex/px/keyframe; kolliziya yo'q (yangi klass/keyframe ffl- prefiksli, `fflBlink` mockup `blink` bilan aynan).
2. **Toggle** — `<head>`da erta skript `?hero=a` → `<html>.ffl-hero-a`. `a`=A ko'rsat/B yashir; `b` yoki parametrsiz = **B (STANDART, o'zgarmagan)**. Faqat hero bloki almashadi; hero-below hammasi umumiy.
3. **JS** — jonli gen sikli `installLanding()`ga (idempotent `__fflGen`, `?hero=a`+reduced-motion gate, `isConnected` self-clean); typing + reveal mavjud dvigatellardan foydalanadi. reduced-motion kill ro'yxatiga HERO A animatsiyalari qo'shildi.

**Topilgani:** dc-runtime = React; statik/binding-siz tugunlar re-render'da tegilmaydi → imperativ mutatsiya (className/textContent) xavfsiz (heroB typing/parallax naqshi).

**Tekshirildi (preview 1280/960/390):** A=mockup 1:1 (rail@≥820, resgrid 4→2 ustun@≤820); B o'zgarmagan+standart (computed: A=none, B=flex, `<html>` sinfsiz); hero-below ikkalasida bir xil; goRegister/goTemplates + typing ishlaydi; konsol xatosi yo'q; reduced-motion hurmat.

**Kutilmoqda:** commit qilindi (push YO'Q — CF Pages deploy'ni foydalanuvchi qiladi). G'olib tanlangach yutqazgan variant olib tashlanadi.
