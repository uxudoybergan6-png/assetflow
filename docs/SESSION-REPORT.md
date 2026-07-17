# SESSION-REPORT — SC_38 guest/login audit (2026-07-18)

Nima qilindi: guest/login oqimlari ikkala ilovada lokal stack (:4000) bilan jonli tekshirildi.
- Web: login/logout/xato/expired PASS; ff-auth-expired endi joriy ekranni eslab, qayta kirgach o'sha yerga qaytaradi (index.html).
- Plagin: guest ekran, sheet login, logout, session-expired modal, device-code oqimi END-TO-END PASS.
- FIX: device.html lokalda prod meta'ga urardi → localhost'da nisbiy /api (dev proxy) ishlatiladi.
- FIX: plagin boot double-fetch (catalog+featured ×2) — applyNavSwitch noReload; endi ×1.
- FIX: device fallback "Copy link" qora-ustida-qora → var(--accent)/var(--on-accent) tokenlar.
- FIX: guest foot eskirgan "3 IMPORTS/MO" → "15 DOWNLOADS/MO" (Account sheet bilan bir xil).
- CMS guest maydonlari (title/sub/features) jonli qo'llanishi tasdiqlandi; guest top-bar = faqat "Sign in" pill.

Qoldiq: guest boot'da models×4 + /api/logs 401 (jim, bir martalik) — kosmetik shovqin, auth emas.
QA: node --check 7/7 OK; install-cep.sh OK (AE qayta ochish kerak); 3 tema OK; konsol toza.
