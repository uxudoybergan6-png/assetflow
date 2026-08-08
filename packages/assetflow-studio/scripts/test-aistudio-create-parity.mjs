import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("packages/assetflow-studio/platform/index.html", "utf8");
const report = fs.readFileSync("docs/SESSION-REPORT.md", "utf8");

assert.ok(/\bff-create-composer\b/.test(src), "composer carries FINAL-CREATE container class");
assert.ok(/class=\"va-dock ff-create-composer\"/.test(src), "composer wrapper uses both web and FINAL-CREATE classes");
assert.ok(/\.ff\s+\.va-dock\.ff-create-composer,[\s\S]*?\.ff-create-composer\{[\s\S]{0,220}?position:\s*absolute[\s\S]{0,80}?left:\s*0;[\s\S]{0,40}?right:\s*0;[\s\S]{0,40}?bottom:\s*18px/.test(src), "desktop FINAL-CREATE composer keeps absolute left/right/bottom");
assert.ok(/@media\s*\(max-width:\s*820px\)[\s\S]*\.ff\s+\.ff-create-composer\{[\s\S]{0,140}?position:\s*static/.test(src), "mobile keeps FINAL-CREATE composer static positioning");

assert.ok(/class=\"va-promptwrap ff-create-write\"/.test(src), "prompt wrap maps to FINAL-CREATE write row");
assert.ok(/class=\"\{\{ promptCls \}\} ff-create-prompt\"[^>]*contenteditable=\"true\"[^>]*role=\"textbox\"[^>]*aria-multiline=\"true\"[^>]*aria-label=\"Generation prompt\"[^>]*aria-describedby=\"ffCreateStatus\"[^>]*tabindex=\"0\"/.test(src), "prompt host is declaratively keyboard-editable and accessible before runtime enhancement");
assert.ok(/class=\"\{\{ promptExpCls \}\} ff-create-promptexp\"/.test(src), "prompt expand button includes FINAL-CREATE marker");
const promptRow = src.match(/<div class=\"va-promptwrap ff-create-write\">[\s\S]*?<div class=\"va-dockrow ff-create-controls\">/);
assert.ok(!!promptRow, "prompt-row composer wrapper exists");
assert.ok(promptRow && !/<sc-if value=\"\{\{ showPromptBar \}\}\"[\s\S]*?<span class=\"va-axrefplus ff-create-add\"/.test(promptRow[0]), "reference-plus is not inside showPromptBar conditional");
assert.ok(/class=\"va-promptwrap ff-create-write\"[\s\S]{0,420}class=\"va-axrefplusw ff-create-refwrap\"/.test(src), "plus menu stays inside ff-create-write");
assert.ok(/class=\"va-axrefplus ff-create-add\"/.test(src), "reference plus control keeps FINAL-CREATE alias");

assert.ok(/class=\"va-dockrow ff-create-controls\"/.test(src), "controls row includes FINAL-CREATE class");
assert.ok(/class=\"va-setgroup ff-create-setgroup\"/.test(src), "control group includes FINAL-CREATE class");
assert.ok(/va-set mode ff-create-control ff-create-modewrap ff-create-modebtn/.test(src), "mode chip keeps FINAL-CREATE control aliases");
assert.ok(/ff-create-model/.test(src), "model control keeps FINAL-CREATE class");
assert.ok(/ff-create-control ff-create-settings/.test(src), "settings control keeps FINAL-CREATE class");
assert.ok(/ff-create-enhance/.test(src), "enhance control keeps FINAL-CREATE class");
assert.ok(/va-genwrap ff-create-actions/.test(src), "generate actions row keeps FINAL-CREATE class");
assert.ok(/class=\"\{\{ genBtnCls \}\} ff-create-generate\"[^>]*aria-disabled=\"\{\{ genAriaDisabled \}\}\"[\s\S]{0,180}\{\{ genBtnLabel \}\}[\s\S]{0,80}<span class=\"va-axcost ff-create-cost\"/.test(src), "Generate exposes its blocked state and keeps label before inline cost");
assert.ok(/va-axcost ff-create-cost/.test(src), "cost indicator keeps FINAL-CREATE class");
assert.ok(/class=\"va-set enh ff-create-enhance\"[\s\S]{0,260}><svg class=\"va-ic\"[\s\S]{0,80}<span class=\"ff-create-enhance-label\">\{\{ enhLabel \}\}<\/span>/.test(src), "Enhance keeps hideable label for icon-only control parity");
assert.ok(/<div class=\"va-genwrap ff-create-actions\">[\s\S]{0,520}ff-create-enhance[\s\S]{0,520}ff-create-generate/.test(src), "Enhance and Generate share the FINAL-CREATE actions group in order");

assert.ok(/id=\"ffCreateStatus\" class=\"\{\{ genStatusCls \}\}\" aria-live=\"polite\"\>\{\{ genStatusText \}\}<\/div>/.test(src), "composer exposes an announced FINAL-CREATE status row");
const genStatusTextDecl = src.match(/let\s+genStatusText\s*=\s*'';/);
const genStatusClsDecl = src.match(/const genStatusCls[\s\S]*?;\n/);
const genGateOnDecl = src.match(/const\s+genGateOn\s*=\s*[\s\S]*?;/);
const genGateTopupDecl = src.match(/const\s+genGateTopup\s*=\s*[\s\S]*?;/);
const genGateMsgDecl = src.match(/const\s+genGateMsg\s*=\s*[\s\S]*?;/);
assert.ok(!!genStatusTextDecl, "genStatusText declaration captured");
assert.ok(!!genStatusClsDecl, "web status class derivation captured");
assert.ok(!!genGateOnDecl && !!genGateTopupDecl && !!genGateMsgDecl, "gen gate declarations captured");
assert.ok(genStatusTextDecl.index > genGateOnDecl.index, "genStatusText declared after genGateOn declaration");
assert.ok(genStatusTextDecl.index > genGateTopupDecl.index, "genStatusText declared after genGateTopup declaration");
assert.ok(genStatusTextDecl.index > genGateMsgDecl.index, "genStatusText declared after genGateMsg declaration");
assert.ok(/' loading'/.test(genStatusClsDecl[0]) && /' err'/.test(genStatusClsDecl[0]) && /' ok'/.test(genStatusClsDecl[0]), "web status class includes loading/error/ready variants");
const controlsRowMatch = src.match(/<div class=\"va-dockrow ff-create-controls\">[\s\S]*?<div class=\"va-genwrap ff-create-actions\">[\s\S]*?<\/div>\s*<\/div>/);
assert.ok(!!controlsRowMatch, "controls row has actions and closes");
const afterControlsRow = src.slice((controlsRowMatch.index || 0) + controlsRowMatch[0].length);
const controlsRowText = src.slice(controlsRowMatch.index, (controlsRowMatch.index || 0) + controlsRowMatch[0].length);
assert.ok(/^\s*<div id=\"ffCreateStatus\" class=\"\{\{ genStatusCls \}\}\" aria-live=\"polite\">\{\{ genStatusText \}\}<\/div>/.test(afterControlsRow), "status row is immediately after controls row");
assert.ok(!controlsRowText.includes('id=\"ffCreateStatus\"'), "status row is not inside ff-create-controls");
assert.ok(/button data-tool=\"\{\{ t.key \}\}\" onclick=\"\{\{ onPickTool \}\}\" class=\"\{\{ t.poprowCls \}\}\" aria-selected=\"\{\{ t.popSel \}\}\"/.test(src), "mode menu rows include ff-create-mode selected binding");
assert.ok(/const genStatusCls = 'ff-create-status'/.test(src), "web status class derivation exists");
assert.ok(!/genStatusText\s*=\s*genGateMsg/.test(src), "dedicated gate message is not duplicated in the status row");
assert.ok(/if \(!axIsUpscaleTool && !axPromptReady\) genStatusText = 'Write a prompt to begin';/.test(src), "empty prompt cannot claim the composer is ready");
assert.ok(/else if \(axPromptReady && !genGateOn && model/.test(src), "Ready status requires a valid prompt");
assert.ok(/genAriaDisabled: genBlocked \? 'true' : 'false'/.test(src), "Generate aria-disabled follows the runtime generation gate");

assert.ok(/ffa-pop ff-create-refmenu/.test(src), "reference popup has FINAL-CREATE marker");
assert.ok(/ffa-pop ff-create-modemenu/.test(src), "mode popup has FINAL-CREATE marker");
assert.ok(/ffa-pop mdl ff-create-setpop/.test(src), "model popup has FINAL-CREATE marker");
assert.ok(/ffa-pop va-setpop ff-create-setpop/.test(src), "settings popup has FINAL-CREATE marker");
assert.ok(/<span class=\"pc\">\{\{ m\.costLabel \}\}<\/span>/.test(src), "model quick-picker uses raw costLabel without hardcoded marker");

const hasCss = (selector) => {
  const re = new RegExp(`(^|[^\\w\\-])${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&").replace(/ /g, "\\\\s*")}\\s*\\{`, "i");
  return re.test(src);
};
assert.ok(hasCss(".ff-create-composer"), "FINAL-CREATE composer CSS block exists");
assert.ok(hasCss(".ff-create-write"), "FINAL-CREATE write-row CSS block exists");
assert.ok(hasCss(".ff-create-prompt"), "FINAL-CREATE prompt CSS block exists");
assert.ok(/\.ff\s+\.ff-create-prompt\{[^}]*caret-color:\s*var\(--lime\)/.test(src), "prompt has a visible text caret");
assert.ok(/\.ff\s+\.ff-create-prompt:focus-visible\{[^}]*box-shadow:/.test(src), "prompt exposes keyboard focus visibly");
assert.ok(hasCss(".ff-create-controls"), "FINAL-CREATE controls CSS block exists");
assert.ok(hasCss(".ff-create-setgroup"), "FINAL-CREATE setgroup CSS block exists");
assert.ok(hasCss(".ff-create-control"), "FINAL-CREATE control CSS block exists");
assert.ok(hasCss(".ff-create-modewrap"), "FINAL-CREATE modewrap CSS block exists");
assert.ok(hasCss(".ff-create-model"), "FINAL-CREATE model CSS block exists");
assert.ok(hasCss(".ff-create-settings"), "FINAL-CREATE settings CSS block exists");
assert.ok(/\.ff\s+\.ff-create-model\{[^}]*overflow:\s*visible/.test(src), "model control keeps its nested picker visible outside the pill");
assert.ok(/\.ff\s+\.ff-create-settings\{[^}]*overflow:\s*visible/.test(src), "settings control keeps its nested picker visible outside the pill");
assert.ok(!/\.ff\s+\.ff-create-(?:model|settings)\{[^}]*overflow:\s*hidden/.test(src), "nested model/settings pickers cannot be clipped by their parent pills");
assert.ok(hasCss(".ff-create-actions"), "FINAL-CREATE actions CSS block exists");
assert.ok(hasCss(".ff-create-add"), "FINAL-CREATE add button CSS block exists");
assert.ok(hasCss(".ff-create-generate"), "FINAL-CREATE generate button CSS block exists");
assert.ok(hasCss(".ff-create-setpop"), "FINAL-CREATE set-popover CSS block exists");
assert.ok(hasCss(".ff-create-enhance"), "FINAL-CREATE enhance button CSS block exists");
assert.ok(hasCss(".ff-create-status"), "FINAL-CREATE status row CSS block exists");
assert.ok(hasCss(".ff-create-refmenu"), "FINAL-CREATE reference menu CSS block exists");
assert.ok(/\.ff\s+\.ff-create-composer\{[\s\S]{0,220}border:\s*1px solid rgba\(255,255,255,\.13\)/.test(src), "composer border matches FINAL-CREATE");
assert.ok(/\.ff\s+\.ff-create-generate\{[^}]*padding:\s*0 15px/.test(src), "Generate padding matches FINAL-CREATE");
assert.ok(/\.ff\s+\.ff-create-cost\{[^}]*margin-left:\s*5px/.test(src), "inline cost spacing matches FINAL-CREATE");
assert.ok(/@media\s*\(max-width:\s*520px\)[\s\S]*ff-create-composer/.test(src), "mobile FINAL-CREATE composer media query exists");
assert.ok(/\.ff-create-refmenu\{[^}]*top:\s*calc\(100% \+ 10px\)[^}]*bottom:\s*auto[^}]*\}/.test(src), "reference menu uses one unambiguous vertical anchor outside the add button");

assert.ok(/\.ff\s+\.ff-create-enhance\{[^}]*min-width:\s*35px[^}]*width:\s*35px[^}]*\}/.test(src), "Enhance control preserves 35px icon-only width");

const scForOpenTags = (src.match(/<sc-for\b[^>]*>/g) || []).length;
const scForCloseTags = (src.match(/<\/sc-for>/g) || []).length;
assert.strictEqual(scForOpenTags, scForCloseTags, `all sc-for open/close tags are balanced (open=${scForOpenTags}, close=${scForCloseTags})`);
assert.ok(/class=\"va-sgh\">Count<\/div>[\s\S]*?<sc-for list=\"\{\{ countsView \}\}\" as=\"z\" hint-placeholder-count=\"4\">[\s\S]*?<\/sc-for>/.test(src), "count settings retains complete counts loop block");
assert.ok(!/const\s+genStatusText\s*=\s*genStatus/.test(src), "genStatusText is not assigned from genStatus");
const modelQuickPickerLoop = src.match(/<sc-for list=\"\{\{ modelPickView \}\}\" as=\"m\" hint-placeholder-count=\"3\">[\s\S]*?<\/sc-for>/);
assert.ok(!!modelQuickPickerLoop, "model quick-picker loop exists");
if (modelQuickPickerLoop) {
  assert.ok(!/class=\"pc\">\s*✦\s*\{\{ m\.costLabel \}\}/.test(modelQuickPickerLoop[0]), "model quick-picker does not add duplicated ✦ before costLabel");
}

const nonEmptyReportLines = report.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
assert.ok(nonEmptyReportLines.length <= 15, `SESSION-REPORT contains <=15 non-empty lines (found ${nonEmptyReportLines.length})`);

console.log("Aistudio FINAL-CREATE composer parity checks passed.");
