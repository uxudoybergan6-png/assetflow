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
import cors from "cors";
import { assetsRouter } from "./routes/assets.js";
import { authRouter } from "./routes/auth.js";
import { stripeWebhookHandler } from "./routes/stripe.js";
import { pluginRouter } from "./routes/plugin.js";
import { adminRouter } from "./routes/admin.js";
import { usersRouter } from "./routes/users.js";
import { contributorRouter } from "./routes/contributor.js";
import { logsRouter } from "./routes/logs.js";
import { messagesRouter } from "./routes/messages.js";
import { auditRouter } from "./routes/audit.js";

const app = express();
const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

const defaultOrigins = [
  "http://localhost:3000",
  "https://localhost:3000",
  "null",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? defaultOrigins;
      if (allowed.includes(origin) || origin.startsWith("file://")) {
        callback(null, true);
        return;
      }
      callback(null, true);
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

app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/plugin", pluginRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/contributor", contributorRouter);
app.use("/api/logs", logsRouter);
app.use("/api/studio/messages", messagesRouter);
app.use("/api/studio/audit", auditRouter);

/** Production env validatsiyasi — xavfsizlik blokerlari */
function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const jwt = process.env.JWT_SECRET?.trim();
  const warnings: string[] = [];

  // JWT_SECRET — productionda default qiymat = kritik xavf
  if (!jwt || jwt === "dev-secret-change-me") {
    if (isProd) {
      console.error(
        "[FATAL] JWT_SECRET o'rnatilmagan (yoki default). Productionda majburiy — server to'xtatildi."
      );
      process.exit(1);
    }
    warnings.push("JWT_SECRET default (dev) — productionda kuchli qiymat shart");
  } else if (jwt.length < 24) {
    warnings.push("JWT_SECRET juda qisqa — kamida 32 belgi tavsiya etiladi");
  }

  if (!process.env.RESEND_API_KEY?.trim())
    warnings.push("RESEND_API_KEY yo'q — email yuborilmaydi (parol tiklash/bildirishnoma)");
  if (!process.env.STRIPE_SECRET_KEY?.trim())
    warnings.push("STRIPE_SECRET_KEY yo'q — to'lov o'chirilgan");
  if (isProd && !process.env.CORS_ORIGIN?.trim())
    warnings.push("CORS_ORIGIN yo'q — barcha originlarga ruxsat berilmoqda");

  if (warnings.length) {
    console.warn("[env] Ogohlantirishlar:\n  - " + warnings.join("\n  - "));
  }
}

validateEnv();

app.listen(PORT, "0.0.0.0", () => {
  const stripe = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeNote = stripe?.startsWith("sk_")
    ? "Stripe: enabled"
    : "Stripe: disabled (Contributor/API works without it)";
  console.log(`API running on http://localhost:${PORT} — ${stripeNote}`);
});
