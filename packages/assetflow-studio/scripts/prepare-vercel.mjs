/**
 * Vercel static deploy — barcha URL lar uchun haqiqiy fayllar
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// /studio/contributor/, /studio/js/, /studio/styles/
copyDir(path.join(root, "js"), path.join(root, "studio", "js"));
copyDir(path.join(root, "styles"), path.join(root, "studio", "styles"));
copyFile(
  path.join(root, "contributor", "index.html"),
  path.join(root, "studio", "contributor", "index.html")
);
copyFile(path.join(root, "login.html"), path.join(root, "studio", "login.html"));
copyFile(path.join(root, "hub.html"), path.join(root, "studio", "hub.html"));

// /admin/ — base href="/admin/" → admin/js, admin/styles
copyDir(path.join(root, "js"), path.join(root, "admin", "js"));
copyDir(path.join(root, "styles"), path.join(root, "admin", "styles"));

console.log("Vercel paths: studio/{contributor,js,styles,login,hub}, admin/{js,styles}");
