#!/usr/bin/env node
/**
 * Brauzer-QA proksisi — portlangan AE UI'ni Premiere'ni qayta ishga tushirmasdan
 * tekshirish uchun.
 *
 * Nega kerak: UXP/CEP panelida CORS yo'q, brauzerda esa bor. Portlangan sahifani
 * `localhost:8974` dan ochsak, `api.getframeflow.app` ga so'rovlar CORS'da
 * to'xtaydi va UI hech qachon login'dan o'tmaydi. `assetflow-env.js` localhost'da
 * API'ni `http://localhost:4000` deb oladi — shu sabab proksi AYNAN 4000 da.
 *
 * TUZOQ (memory: plugin-browser-qa-cors-proxy): login javobidagi `apiBaseUrl`
 * prod manzilni qaytaradi va klient uni saqlab qo'yadi → keyingi so'rovlar yana
 * to'g'ridan-to'g'ri prodga ketadi. Shu sabab javob tanasida uni qayta yozamiz.
 *
 * Bu FAQAT lokal QA vositasi — paketga (.ccx) kirmaydi.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM = process.env.FF_API || "https://api.getframeflow.app";
const PORT = Number(process.env.FF_PROXY_PORT || 4000);
const SELF = `http://localhost:${PORT}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "600",
};

/**
 * `/__qa/<kalit>` — QA uchun kichik xotira. AE originali (8976) va portlangan
 * sahifa (8974) turli origin'da; layout imzosini solishtirish uchun biri yozadi,
 * ikkinchisi o'qiydi. Proksiga tegishli — paketga kirmaydi.
 */
// Diskda saqlaymiz: AE imzolarini yig'ish ~2 daqiqa vaqt oladi, proksi qayta
// ishga tushgani uchun ularni yo'qotish qimmat.
const QA_DIR = process.env.FF_QA_DIR || path.join(os.tmpdir(), "ff-qa-store");
fs.mkdirSync(QA_DIR, { recursive: true });
const qaFile = (k) => path.join(QA_DIR, encodeURIComponent(k) + ".json");

/**
 * QA drayveri — AE (8976) va port (8974) uni SHU YERDAN oladi (CORS ochiq).
 *
 * Imzo kutubxonasi (`qa-layout-sig.js`) DRAYVER bilan BIRGA beriladi: statik
 * serverlarda CORS sarlavhasi yo'q, shu sabab tab uni o'zi yuklab ololmaydi
 * (o'lchovda: AE tabida `FFQA is not defined` — butun supurish xato bergan).
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRIVE_PARTS = [path.join(HERE, "qa-layout-sig.js"), path.join(HERE, "qa-drive.js")];

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }

  if (req.url.split("?")[0] === "/__drive.js") {
    let body;
    try { body = DRIVE_PARTS.map((p) => fs.readFileSync(p, "utf8")).join("\n;\n"); } catch (e) {
      res.writeHead(500, { ...CORS, "content-type": "text/plain" }); res.end(String(e)); return;
    }
    res.writeHead(200, { ...CORS, "content-type": "application/javascript", "cache-control": "no-store" });
    res.end(body);
    return;
  }

  if (req.url.startsWith("/__qa/")) {
    const key = req.url.slice("/__qa/".length);
    if (req.method === "GET") {
      let v = null;
      try { v = fs.readFileSync(qaFile(key), "utf8"); } catch (e) { /* yo'q */ }
      res.writeHead(v ? 200 : 404, { ...CORS, "content-type": "application/json" });
      res.end(v || JSON.stringify({ error: "not_found", key }));
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString("utf8");
    fs.writeFileSync(qaFile(key), body);
    res.writeHead(204, CORS); res.end();
    console.log(`__qa saqlandi: ${key} (${body.length} bayt)`);
    return;
  }

  const url = UPSTREAM + req.url;
  const headers = { ...req.headers };
  delete headers.host; delete headers.origin; delete headers.referer;
  delete headers["accept-encoding"];   // tanani qayta yozish uchun siqilmagan kerak

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
    if (body.length === 0) body = undefined;
  }

  try {
    const up = await fetch(url, { method: req.method, headers, body, redirect: "manual" });
    const ct = up.headers.get("content-type") || "";
    const out = { ...CORS, "content-type": ct };
    const loc = up.headers.get("location");
    if (loc) out.location = loc;

    if (ct.includes("application/json")) {
      let text = await up.text();
      // Prod manzilni proksiga qaytaramiz — aks holda login'dan keyin CORS qaytadi.
      text = text.split(UPSTREAM).join(SELF);
      res.writeHead(up.status, out);
      res.end(text);
    } else {
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(up.status, out);
      res.end(buf);
    }
    console.log(`${up.status} ${req.method} ${req.url.slice(0, 90)}`);
  } catch (e) {
    res.writeHead(502, { ...CORS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: "proxy_failed", message: String((e && e.message) || e) }));
    console.error(`502 ${req.method} ${req.url} :: ${e}`);
  }
});

server.listen(PORT, () => console.log(`QA proksi :${PORT} → ${UPSTREAM}`));
