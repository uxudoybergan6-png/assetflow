import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });
import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { stripeWebhookHandler } from "./routes/stripe.js";
import { pluginRouter } from "./routes/plugin.js";
import { adminRouter } from "./routes/admin.js";
import { usersRouter } from "./routes/users.js";
import { contributorRouter } from "./routes/contributor.js";
import { logsRouter } from "./routes/logs.js";
import { messagesRouter } from "./routes/messages.js";
import { auditRouter } from "./routes/audit.js";
import { aiRouter } from "./routes/ai.js";
import { studioGenRouter } from "./routes/studio-gen.js";
import { logS3Diagnostics } from "./lib/s3.js";

const app = express();
const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

// Render/Vercel kabi reverse-proxy ortida req.ip = X-Forwarded-For (rate-limit
// to'g'ri ishlashi uchun). Bitta proxy hop.
app.set("trust proxy", 1);

// Env validatsiyasi — JWT_SECRET kabi xavfsizlik blokerlarini server
// ishga tushishidan OLDIN tekshiramiz (productionda default = process.exit).
validateEnv();

const defaultOrigins = [
  "http://localhost:3000",
  "https://localhost:3000",
];

app.use(
  cors({
    origin(origin, callback) {
      // Origin yo'q (server-to-server, curl) yoki CEP plugin (file:// / "null") — ruxsat
      if (!origin || origin === "null" || origin.startsWith("file://")) {
        return callback(null, true);
      }
      const raw = process.env.CORS_ORIGIN?.trim();
      // CORS_ORIGIN=* → hammaga ruxsat (test/staging muhiti)
      if (!raw || raw === "*") {
        return callback(null, true);
      }
      const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
      callback(null, allowed.includes(origin));
    },
    credentials: true,
  })
);

app.get("/", (_req, res) => {
  res.json({
    service: "creative-tools-api",
    status: "ok",
    health: "/health",
    pluginCatalog: "/api/plugin/catalog",
    docs: "AssetFlow API — AE plugin va Studio shu manzildan foydalanadi.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "creative-tools-api" });
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Studio Gen'da ikki endpoint juda katta base64 payload qabul qiladi:
// - /gen/ref-upload  → R2V image/video/audio referenslar
// - /gen/describe    → haqiqiy video input (data-URL) yoki bir nechta kadr
// 100MB binary base64'dа ~133MB+ bo'ladi, shu sabab route-level limit kattaroq.
app.use("/api/studio/gen/ref-upload", express.json({ limit: "150mb" }));
app.use("/api/studio/gen/describe", express.json({ limit: "150mb" }));
// Qolgan API JSON'lari uchun odatdagi limit.
app.use(express.json({ limit: "14mb" }));
app.use("/api/auth", authRouter);
app.use("/api/plugin", pluginRouter);
app.use("/api/plugin/ai", aiRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/contributor", contributorRouter);
app.use("/api/logs", logsRouter);
app.use("/api/studio/messages", messagesRouter);
app.use("/api/studio/audit", auditRouter);
app.use("/api/studio", studioGenRouter);

// Topilmagan yo'llar — JSON 404 (hang emas)
app.use((_req, res) => {
  res.status(404).json({ error: "Topilmadi" });
});

// Global xato ishlovchi — async handler throw qilsa yoki Prisma xato bersa
// so'rov osilib qolmasin. Express 5 async rejection'ni shu yerga uzatadi.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  const code = (err as { code?: string })?.code;
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { status?: number; statusCode?: number })?.statusCode;
  const type = (err as { type?: string })?.type;
  if (code === "P2025") {
    res.status(404).json({ error: "Yozuv topilmadi" });
    return;
  }
  if (code === "P2002") {
    res.status(409).json({ error: "Bunday yozuv allaqachon mavjud" });
    return;
  }
  if (status === 413 || type === "entity.too.large") {
    res.status(413).json({
      error: "Referens juda katta — 100MB dan kichikroq fayl tanlang",
      code: "PAYLOAD_TOO_LARGE",
    });
    return;
  }
  console.error("[api] Kutilmagan xato:", err);
  res.status(500).json({ error: "Server xatosi" });
};
app.use(errorHandler);

/** Production env validatsiyasi — xavfsizlik blokerlari */
function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const jwt = process.env.JWT_SECRET?.trim();
  const warnings: string[] = [];

  // JWT_SECRET — auth token VA cost-quote imzosi BIR XIL kalit bilan imzolanadi (middleware/auth +
  // gen-quote). Zaif/ma'lum/example kalit = soxta ADMIN token (cheksiz kredit) + soxta cost-quote
  // (kredit bypass). Shu sabab productionда: yo'q, ma'lum-zaif, yoki <32 belgi → QAT'IY to'xtatish.
  // (Audit 2026-06-26: oldingi guard faqat "dev-secret-change-me" ni bloklardi → commit qilingan
  // example qiymatlar (.env.example va h.k.) o'tib ketardi.)
  const WEAK_SECRETS = [
    "dev-secret-change-me",
    "dev-secret-change-in-production",
    "change-me-in-production",
    "changeme",
    "secret",
    "your-secret-here",
  ];
  if (!jwt || WEAK_SECRETS.includes(jwt) || jwt.length < 32) {
    if (isProd) {
      console.error(
        "[FATAL] JWT_SECRET zaif/ma'lum/yo'q — productionда kamida 32 belgili TASODIFIY qiymat shart " +
          "(example/dev qiymat EMAS). Server to'xtatildi."
      );
      process.exit(1);
    }
    warnings.push("JWT_SECRET zaif yoki <32 belgi (dev) — productionда kuchli tasodifiy qiymat shart");
  }

  if (!process.env.RESEND_API_KEY?.trim())
    warnings.push("RESEND_API_KEY yo'q — email yuborilmaydi (parol tiklash/bildirishnoma)");
  if (!process.env.STRIPE_SECRET_KEY?.trim())
    warnings.push("STRIPE_SECRET_KEY yo'q — to'lov o'chirilgan");
  if (isProd && !process.env.CORS_ORIGIN?.trim())
    warnings.push("CORS_ORIGIN yo'q — barcha originlarga ruxsat berilmoqda (production uchun URL ro'yxati tavsiya)");
  else if (isProd && process.env.CORS_ORIGIN?.trim() === "*")
    warnings.push("CORS_ORIGIN=* — barcha originlarga ruxsat (faqat test uchun, productga URL ro'yxati tavsiya)");

  if (warnings.length) {
    console.warn("[env] Ogohlantirishlar:\n  - " + warnings.join("\n  - "));
  }
}

app.listen(PORT, "0.0.0.0", () => {
  const stripe = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeNote = stripe?.startsWith("sk_")
    ? "Stripe: enabled"
    : "Stripe: disabled (Contributor/API works without it)";
  console.log(`API running on http://localhost:${PORT} — ${stripeNote}`);
  logS3Diagnostics();
});
