/**
 * AssetFlow Admin Console — alohida port (default 3001)
 * http://localhost:3001/
 */
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.ADMIN_PORT || 3001);
const API = process.env.API_URL || "http://localhost:4000";

const app = express();

app.use(
  "/health",
  createProxyMiddleware({
    target: API,
    changeOrigin: true,
  })
);
app.use(
  "/api",
  createProxyMiddleware({
    target: API,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
  })
);

app.use("/js", express.static(path.join(ROOT, "js")));
app.use("/styles", express.static(path.join(ROOT, "styles")));
// Self-hosted fontlar (admin.css → /assets/fonts) — prod'da platform/ dist root'ga tushadi
app.use("/assets", express.static(path.join(ROOT, "platform", "assets")));

// Lokalda production API meta'sini olib tashlaymiz — studio-config origin
// (:3001 proxy → :4000) ga qaytadi. Cloud Run CORS localhost'ga ruxsat bermaydi.
function sendHtmlLocalApi(res, file) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<meta name="(?:assetflow|frameflow)-api"[^>]*>\s*/g, "");
  res.type("html").send(html);
}

app.get("/login.html", (_req, res) => {
  sendHtmlLocalApi(res, path.join(ROOT, "admin-login.html"));
});

app.get("/", (_req, res) => {
  sendHtmlLocalApi(res, path.join(ROOT, "admin", "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.redirect(302, "/");
});

const server = app.listen(PORT, () => {
  console.log(`AssetFlow Admin Console: http://localhost:${PORT}/`);
  console.log(`  Login:  http://localhost:${PORT}/login.html`);
  console.log(`  API:    ${API} — brauzer to'g'ridan ulanadi (npm run dev:api)`);
  console.log(`Contributor: http://localhost:3000/studio/hub.html`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  ✗ Port ${PORT} band. npm run pm2:reset yoki: kill $(lsof -t -i :${PORT})\n`
    );
    process.exit(1);
  }
  throw err;
});
