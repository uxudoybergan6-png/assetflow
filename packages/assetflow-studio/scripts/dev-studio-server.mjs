/**
 * AssetFlow Contributor Studio — lokal dev host (default :3000).
 * http://localhost:3000/studio/hub.html
 *
 * #10: eski apps/web (Next.js) lokal host o'rnini bosadi. Studio MANBASINI
 * (packages/assetflow-studio: js/, styles/, *.html, contributor/) to'g'ridan
 * serv qiladi + /api ni dev:api (:4000) ga proxy. CF Pages (prepare-cf-pages.mjs)
 * va Vercel (prepare-vercel.mjs) deploy'lari bu skriptga bog'liq EMAS — bu faqat
 * lokal dev. Routing CF _redirects / vercel.json bilan bir xil (/studio/* → manba).
 */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.STUDIO_PORT || 3000);
const API = process.env.API_URL || "http://localhost:4000";

const app = express();

// API proxy — brauzer to'g'ridan ulanadi (CORS/cookie'siz, dev qulayligi uchun)
app.use("/health", createProxyMiddleware({ target: API, changeOrigin: true }));
app.use(
  "/api",
  createProxyMiddleware({ target: API, changeOrigin: true, pathRewrite: (p) => `/api${p}` })
);

// Statik asset'lar — manbadan (CF _redirects /studio/js → /js bilan bir xil)
app.use("/js", express.static(path.join(ROOT, "js")));
app.use("/styles", express.static(path.join(ROOT, "styles")));
app.use("/studio/js", express.static(path.join(ROOT, "js")));
app.use("/studio/styles", express.static(path.join(ROOT, "styles")));

// HTML routing (vercel.json rewrites bilan bir xil)
const send = (rel) => (_req, res) => res.sendFile(path.join(ROOT, rel));
app.get(["/", "/studio/hub.html", "/hub.html"], send("hub.html"));
app.get(["/studio/login.html", "/login.html"], send("login.html"));
app.get(
  ["/studio/contributor", "/studio/contributor/", "/contributor", "/contributor/"],
  send(path.join("contributor", "index.html"))
);
app.get("/reset-password.html", send("reset-password.html"));

// Qolgan statik fayllar (admin-login.html, index.html, design-system.html, ...)
app.use(express.static(ROOT));

const server = app.listen(PORT, () => {
  console.log(`AssetFlow Studio (Contributor): http://localhost:${PORT}/studio/hub.html`);
  console.log(`  Login: http://localhost:${PORT}/studio/login.html`);
  console.log(`  API:   ${API} (npm run dev:api)`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  ✗ Port ${PORT} band. npm run pm2:reset yoki: kill $(lsof -t -i :${PORT})\n`);
    process.exit(1);
  }
  throw err;
});
