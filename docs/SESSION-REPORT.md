# SESSION REPORT — 2026-06-15 — Panelda build/versiya yorlig'i ✅

Maqsad: install-cep + AE qayta ochishdan keyin panelда yorliqни ko'rib, yangi build
yuklanganini DARROV bilish (stale-panel chalkashligini bartaraf etish).

## Qo'shildi
- **AssetFlow_Plugin.html** sidebar-foot (kredit-pill ostida): `<div id="afBuild">build: __AF_BUILD__</div>`
  — muted, kichik (10px), ko'zga tashlanmaydigan. CSS `.sb-build` (tokenlar).
- **install-cep.sh** AVTOMATIK shtamplaydi: o'rnatilgan HTML'da `__AF_BUILD__` →
  `"<sana HH:MM> · <git short hash>"` (sed). Manba placeholder bo'lib qoladi (git churn yo'q).
  Konsolga ham `Build: ...` chiqaradi.
- Boot normalizatsiya: shtamplanmagan (manbadan) bo'lsa → "build: dev". Token JS'da BO'LIB
  yozilgan (`'__AF_'+'BUILD__'`) — sed bu tekshiruvga tegmaydi, faqat element shtamplanadi.

## Tekshirildi
- HTML inline JS `node --check` TOZA ✅; `bash -n install-cep.sh` TOZA ✅
- Temp-nusxada sed sinovi: element shtamplandi, boot-tekshiruv buzilmadi, qolgan placeholder 0 ✅
- Haqiqiy `install-cep.sh`: `Build: 2026-06-15 11:20 · ed2735c` → o'rnatilgan element'da ko'rindi ✅

## Holat
Panelda (sidebar pastida) "build: <sana> · <hash>" ko'rinadi. AE qayta ochilgach yorliqni
ko'rib yangi build yuklanganini bilasiz. Keyingi: 2a tasdiq → 3a (ko'p-model selektor).
