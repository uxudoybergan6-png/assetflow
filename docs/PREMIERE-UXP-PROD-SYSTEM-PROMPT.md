# ESKIRGAN — Premiere UXP production prompti ishlatilmasin

> 2026-08-04 qarori: UXP portining CSS/layout rendererida UI buzilgani sabab joriy
> FrameFlow Premiere yo'li **dual-host CEP**ga almashtirildi. Bu fayldagi eski UXP
> repaint/shim/CCX vazifalari endi production topshirig'i emas.

Codex uchun joriy to'liq prompt:

- [`PREMIERE-CEP-PROD-SYSTEM-PROMPT.md`](./PREMIERE-CEP-PROD-SYSTEM-PROMPT.md)

Kod-tasdiqlangan audit:

- [`PREMIERE-CEP-PROD-AUDIT-2026-08-04.md`](./PREMIERE-CEP-PROD-AUDIT-2026-08-04.md)

Joriy loyiha holati:

- [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) §12

Qat'iy qoida: eski UXP promptini agentga bermang va `plugins/premiere-uxp/`ni joriy
CEP runtime/build yo'liga qayta ulamang.
