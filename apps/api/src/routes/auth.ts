import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import { z } from "zod";
import { prisma, UserRole } from "@creative-tools/database";
import { signToken, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";
import { sendEmail, isEmailConfigured, renderEmailLayout } from "../lib/email.js";
import { getWebUrl, avatarPublicUrl } from "../lib/app-urls.js";
import {
  isS3Configured,
  uploadBufferToS3,
  getSignedDownloadUrl,
  deleteS3Objects,
} from "../lib/s3.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { verifyGoogleIdTokenAndUpsertUser } from "../lib/google-auth.js";

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 soat
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 soat
/** Email-tasdiqlash tokenlari uchun identifier prefiksi (parol-tiklash bilan
 *  to'qnashmasin — reset identifier=email, verify identifier=`verify:<email>`). */
const VERIFY_ID_PREFIX = "verify:";

/** Email-tasdiqlash havolasini yaratib yuboradi (RESEND_API_KEY yo'q bo'lsa
 *  log'ga yozadi). Eski verify-tokenlarni tozalab, yangisini yozadi. */
async function sendVerificationEmail(email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  const identifier = VERIFY_ID_PREFIX + email;
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });
  const verifyUrl = `${getWebUrl()}/verify-email.html?token=${token}`;
  await sendEmail({
    to: email,
    subject: "FrameFlow — verify your email",
    html: renderEmailLayout(
      "Verify your email",
      `<p style="font-size:13px;line-height:1.6">Welcome to FrameFlow! Please verify your email to use AI generation. This link is valid for 24 hours.</p>
       <a href="${verifyUrl}" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Verify email</a>
       <p style="font-size:11px;color:#888;margin-top:16px;word-break:break-all">${verifyUrl}</p>`
    ),
    text: `Verify your email: ${verifyUrl}`,
  });
  if (!isEmailConfigured()) {
    console.log(`[auth] Email tasdiqlash havolasi (${email}): ${verifyUrl}`);
  }
}

/** Brute-force'dan himoya: Studio/admin login + register */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "auth-login",
  message: "Too many attempts — please try again in 1 minute",
});

/** Parol tiklash — email-bombing oldini olish uchun qattiqroq limit */
const forgotLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "auth-forgot",
  message: "Too many requests — please try again shortly",
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  // FAZA 2 (M1) — `asContributor` self-grant OLIB TASHLANDI: register DOIM USER yaratadi.
  // Contributor bo'lish faqat request → admin-approve orqali (admin.ts canonical, guarded).
  turnstileToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }

  const { email, password, name } = parsed.data;

  // Bot-himoya (Turnstile) — kalit sozlangan bo'lsagina majburlanadi (fail-open).
  const captchaOk = await verifyTurnstile(
    parsed.data.turnstileToken,
    req.ip
  );
  if (!captchaOk) {
    res.status(400).json({ error: "Bot check failed — please refresh the page and try again", code: "CAPTCHA_FAILED" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      // FAZA 2 (M1) — DOIM USER (admin-approval gate'ini chetlab bo'lmasin).
      role: UserRole.USER,
    },
  });

  await prisma.subscription.create({
    data: { userId: user.id, status: "INCOMPLETE" },
  });

  // Email-tasdiqlash havolasini yuboramiz (email sozlanmagan bo'lsa log'ga).
  // Xatoga chidamli — tasdiqlash yuborilmasa ham ro'yxatdan o'tish muvaffaqiyatli
  // (foydalanuvchi keyin "qayta yuborish"dan foydalanadi).
  try {
    await sendVerificationEmail(user.email);
  } catch (e) {
    console.warn("[auth] tasdiqlash emaili yuborilmadi:", e);
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  res.status(201).json({
    token,
    // emailVerifyRequired — email yuborish sozlangan bo'lsa AI gate faol
    // (frontend "emailingizni tasdiqlang" bannerini ko'rsatishi mumkin).
    emailVerifyRequired: isEmailConfigured(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: false,
      contributorBlocked: false,
    },
  });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { subscription: true },
  });

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!user.passwordHash) {
    res.status(401).json({ error: "This account was created with Google — use the 'Sign in with Google' button" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  if (user.role === UserRole.CONTRIBUTOR && user.contributorBlockedAt) {
    res.status(403).json({
      error: "Contributor account is blocked",
      code: "CONTRIBUTOR_BLOCKED",
    });
    return;
  }

  res.json({
    token,
    emailVerifyRequired: isEmailConfigured(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: avatarPublicUrl(user.id, user.image),
      role: user.role,
      emailVerified: !!user.emailVerified,
      subscription: user.subscription,
      contributorBlocked: false,
    },
  });
});

// ── Google bilan kirish/ro'yxatdan o'tish ───────────────────────────────────
const googleAuthSchema = z.object({ credential: z.string().min(10) });

/** Google Identity Services'dan kelgan ID token bilan kirish/ro'yxatdan o'tish.
 *  Google email'ni allaqachon tasdiqlagani uchun emailVerified darhol o'rnatiladi
 *  (Resend'ga bog'liq emas). Mavjud email/parol hisobi bo'lsa — shunga bog'lanadi. */
authRouter.post("/google", authLimiter, async (req, res) => {
  const parsed = googleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }

  const result = await verifyGoogleIdTokenAndUpsertUser(parsed.data.credential);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error, ...(result.code ? { code: result.code } : {}) });
    return;
  }
  const user = result.user;

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  res.json({
    token,
    emailVerifyRequired: isEmailConfigured(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: !!user.emailVerified,
      subscription: user.subscription,
      contributorBlocked: false,
    },
  });
});

// ── Parol tiklash ────────────────────────────────────────────────────────────
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

/** Tiklash havolasini so'rash — email enumeratsiyaga yo'l qo'ymaslik uchun doim 200 */
authRouter.post("/forgot-password", forgotLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }
  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Foydalanuvchi bor bo'lsagina token yaratamiz, lekin javob har doim bir xil
  if (user?.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    // Eski tokenlarni tozalab, yangisini yozamiz
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });
    // reset-password.html CF Pages ROOT'da xizmat qilinadi (getframeflow.app/
    // reset-password.html). Eski `/studio/` prefiksi uchun redirect yo'q edi → 404.
    const resetUrl = `${getWebUrl()}/reset-password.html?token=${token}`;
    await sendEmail({
      to: email,
      subject: "FrameFlow — reset your password",
      html: renderEmailLayout(
        "Reset your password",
        `<p style="font-size:13px;line-height:1.6">Click the button below to reset your password. This link is valid for 1 hour.</p>
         <a href="${resetUrl}" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Reset password</a>
         <p style="font-size:11px;color:#888;margin-top:16px;word-break:break-all">${resetUrl}</p>`
      ),
      text: `Reset your password: ${resetUrl}`,
    });
    if (!isEmailConfigured()) {
      console.log(`[auth] Parol tiklash havolasi (${email}): ${resetUrl}`);
    }
  }

  res.json({
    ok: true,
    message: "If this email is registered, a reset link has been sent",
  });
});

/** Token bilan yangi parol o'rnatish */
authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }
  const { token, password } = parsed.data;
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    res.status(400).json({ error: "Link is invalid or has expired" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
  });
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    // Parol o'zgardi → barcha eski sessiyalarni bekor qilamiz:
    // tokenVersion oshadi (eski JWT'lar rad etiladi) + plugin tokenlar o'chadi.
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  await prisma.pluginToken.deleteMany({ where: { userId: user.id } });
  await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier },
  });
  res.json({ ok: true, message: "Password updated — you can now sign in" });
});

// ── Email tasdiqlash ─────────────────────────────────────────────────────────
const verifyEmailSchema = z.object({ token: z.string().min(10) });

/** Token bilan emailni tasdiqlash (verify-email.html sahifasi chaqiradi). */
authRouter.post("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }
  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });
  // Faqat verify-tokenlar (identifier `verify:` prefiksli) — parol-tiklash
  // tokeni bu yerda ishlamasin.
  if (
    !record ||
    !record.identifier.startsWith(VERIFY_ID_PREFIX) ||
    record.expires < new Date()
  ) {
    res.status(400).json({ error: "Link is invalid or has expired" });
    return;
  }
  const email = record.identifier.slice(VERIFY_ID_PREFIX.length);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }
  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }
  await prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } });
  res.json({ ok: true, message: "Email verified — you can now use AI features", role: user.role });
});

/** Tasdiqlash havolasini qayta yuborish — enumeratsiyaga yo'l qo'ymaslik uchun
 *  doim 200 (email bor va tasdiqlanmagan bo'lsagina haqiqiy yuboradi). */
authRouter.post("/resend-verification", forgotLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.emailVerified) {
    try {
      await sendVerificationEmail(user.email);
    } catch (e) {
      console.warn("[auth] tasdiqlash emaili qayta yuborilmadi:", e);
    }
  }
  res.json({ ok: true, message: "If the account exists and is unverified, a link has been sent" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { subscription: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: avatarPublicUrl(user.id, user.image),
    role: user.role,
    emailVerified: !!user.emailVerified,
    emailVerifyRequired: isEmailConfigured(),
    subscription: user.subscription,
    contributorBlocked: !!user.contributorBlockedAt,
  });
});

// ── Avatar (profil rasmi) — plagin va web BIR endpoint (bir xil JWT) ─────────
const AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** POST /api/auth/avatar — form-data `avatar` fayli; User.image ga GCS key yozadi. */
authRouter.post("/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer?.length) {
    res.status(400).json({ error: "No file uploaded (field: avatar)" });
    return;
  }
  const ext = AVATAR_TYPES[file.mimetype];
  if (!ext) {
    res.status(400).json({ error: "Unsupported image type — use PNG, JPEG or WebP" });
    return;
  }
  if (!isS3Configured()) {
    res.status(503).json({ error: "Storage is not configured" });
    return;
  }
  const userId = req.user!.userId;
  const key = `avatars/${userId}.${ext}`;
  try {
    await uploadBufferToS3(file.buffer, key, file.mimetype, "private, max-age=0");
    // Eski boshqa-kengaytmali avatarni tozalaymiz (png→jpg almashuvida qoldiq qolmasin)
    const stale = Object.values(AVATAR_TYPES)
      .filter((e) => e !== ext)
      .map((e) => `avatars/${userId}.${e}`);
    deleteS3Objects(stale).catch(() => {});
    await prisma.user.update({ where: { id: userId }, data: { image: key } });
    res.json({ ok: true, avatarUrl: avatarPublicUrl(userId, key) });
  } catch (e) {
    console.error("[auth/avatar] upload failed:", e);
    res.status(500).json({ error: "Avatar upload failed" });
  }
});

/** GET /api/auth/avatar/:userId — auth'siz redirect (plagin/web <img> uchun).
 *  Bucket private → qisqa muddatli signed URL'ga 302. */
authRouter.get("/avatar/:userId", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { image: true },
  });
  const image = user?.image;
  if (!image) {
    res.status(404).json({ error: "No avatar" });
    return;
  }
  if (/^https?:\/\//i.test(image)) {
    res.redirect(302, image);
    return;
  }
  try {
    const url = await getSignedDownloadUrl(image, 3600);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.redirect(302, url);
  } catch {
    res.status(404).json({ error: "No avatar" });
  }
});

const profilePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { name: parsed.data.name },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      contributorBlockedAt: true,
    },
  });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    contributorBlocked: !!user.contributorBlockedAt,
  });
});

authRouter.post("/checkout", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    res.status(503).json({
      error: "Stripe is not configured — payments are unavailable right now (local dev)",
      code: "STRIPE_NOT_CONFIGURED",
    });
    return;
  }

  const stripe = getStripe();
  const plan = req.body.plan === "yearly" ? "yearly" : "monthly";
  const priceId =
    plan === "yearly"
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    res.status(500).json({ error: "Stripe price not configured" });
    return;
  }

  let user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    user = await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId!,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getWebUrl()}/studio/contributor/?checkout=success`,
    cancel_url: `${getWebUrl()}/studio/contributor/?checkout=canceled`,
    metadata: { userId: user.id },
  });

  res.json({ url: session.url });
});

authRouter.post("/portal", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    res.status(503).json({
      error: "Stripe is not configured",
      code: "STRIPE_NOT_CONFIGURED",
    });
    return;
  }

  const stripe = getStripe();
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account" });
    return;
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getWebUrl()}/studio/contributor/`,
  });

  res.json({ url: portal.url });
});
