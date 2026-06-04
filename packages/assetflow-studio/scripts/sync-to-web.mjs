import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.resolve(root, "../../apps/web/public/studio");

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(dest, { recursive: true, force: true });
copyDir(root, dest);
fs.rmSync(path.join(dest, "scripts"), { recursive: true, force: true });
fs.rmSync(path.join(dest, "package.json"), { force: true });
execSync("node scripts/prepare-vercel.mjs", { cwd: root, stdio: "inherit" });
copyDir(path.join(root, "studio"), path.join(dest, "studio"));
console.log(`Synced assetflow-studio → ${dest}`);
