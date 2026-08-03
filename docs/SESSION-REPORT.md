# Session report — 2026-08-03 (Premiere UXP production deploy)

- Writable path: plugin-data → plugin-temp → native tmp; UXP 26.2 uchun `path` shim qo'shildi.
- P0: repaint/indexedDB/transform/clipboard va dev-package byte-guardlar tayyor.
- P1: `.prproj` upload + neutral music/SFX `app=pr` katalog filtri tuzatildi.
- P2/P3: `.mogrt`, `.prproj importSequences`, media bundle, async `cep.fs` picker/Base64 ulandi.
- P4/P5: `app=pr` updater, `.ccx` landing, crash-log, app analytics va browse restore tayyor.
- Test: DB/API build; installer 262/262; public 137/137; release 110/110; updater 118/118.
- CCX: 65 fayl, 783.9 KB; SHA-256 `ab42a001aec3795175d2a47ba9c5fb4bad8796d71b7a4067d2a6b9013491d8a0`.
- Jonli: MOGRT saqlandi; Premiere 26.2.2 quit/relaunch; docked panel render; boot xatosi 0.
- Deploy: `c09e563` main; Cloud Run `30828591927` + CI `30828593547` PASS; DB/storage `ok`.
- Production: `app=pr` 2 neutral SFX; webda `.ccx` CTA/qo'llanma jonli; reliz `not_published`.
- Qolgan tashqi darvoza: CCX/admin publish, native PR kontent, login import/AI va Windows beta.
