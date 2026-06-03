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

app.listen(PORT, () => {
  const stripe = process.env.STRIPE_SECRET_KEY?.trim();
  const stripeNote = stripe?.startsWith("sk_")
    ? "Stripe: enabled"
    : "Stripe: disabled (Contributor/API works without it)";
  console.log(`API running on http://localhost:${PORT} — ${stripeNote}`);
});
