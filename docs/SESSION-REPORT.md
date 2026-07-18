# SESSION-REPORT — SC_55: SC_54 composer dead-click + model-overflow regression fix — 2026-07-18

Fixed two live defects introduced by SC_54 (commit 25199cb) in the AI composer control row.

**Root cause of dead clicks:** SC_54 added `overflow:hidden` to `.axws-dockrow` + `.axws-setgroup`
(and web `.va-dockrow`/`.va-setgroup`). Those clip the upward-opening chip popovers
(`.axws-pop`/`.ffa-pop`, `bottom:calc(100%+8px)` — above the clipped box) to **0 height**: clicking
mode/voice/duration opened an invisible menu → "nothing happens". Compounding it, the non-shrink
setting chips overflowed the shrunk setgroup and sat **under** the action group, so model/output
clicks landed on Enhance. `overflow:hidden` masked the visual spill but left dead click zones.

**Plugin fix:** removed both `overflow:hidden`; setgroup `flex:1 0 auto` so overflow surfaces to the
row; measurement now overlap-based (settings' right edge vs genwrap's left) since a shrunk setgroup
hides child overflow from `scrollWidth`; ladder extended — kc6 shrink-backstop (chips floor at
icon+padding, label ellipsizes INSIDE the chip → fixes model-name spill) + kc7/8/9 dropping
Clear→output→model near ~320px where the protected action group can't share the row.
**Web fix:** removed `overflow:hidden`; label `min-width:8ch`→0 (ellipsis in chip); chevron-drop
breakpoint 540→690 to cover the overlap band; hide gear/model under ~460px. Generate+cost & Enhance ✦1
never degraded; exactly one row at every width.

**QA:** every control clicked at 320/380/420/560/900 in image/video/audio — all fire, zero dead
clicks; 30-width sweep (×3 tools) one-row + no overlap + no text outside chip bounds; 3 themes;
`node --check` all 10 inline scripts OK; install-cep.sh OK; console clean (plugin+web).
