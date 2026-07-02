import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma, UserRole } from "@creative-tools/database";
import { signToken, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";
import { sendEmail, isEmailConfigured, renderEmailLayout } from "../lib/email.js";
import { getWebUrl } from "../lib/app-urls.js";

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 soat

/** Brute-force'dan himoya: Studio/admin login + register */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "auth-login",
  message: "Juda ko'p urinish — 1 daqiqadan keyin qayta urinib ko'ring",
});

/** Parol tiklash — email-bombing oldini olish uchun qattiqroq limit */
const forgotLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "auth-forgot",
  message: "Juda ko'p so'rov — birozdan keyin urinib ko'ring",
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  asContributor: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
    return;
  }

  const { email, password, name } = parsed.data;
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
      role: parsed.data.asContributor ? UserRole.CONTRIBUTOR : UserRole.USER,
    },
  });

  await prisma.subscription.create({
    data: { userId: user.id, status: "INCOMPLETE" },
  });

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      contributorBlocked: false,
    },
  });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { subscription: true },
  });

  if (!user?.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
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
      error: "Contributor hisobi bloklangan",
      code: "CONTRIBUTOR_BLOCKED",
    });
    return;
  }

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
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
      subject: "FrameFlow — parolni tiklash",
      html: renderEmailLayout(
        "Parolni tiklash",
        `<p style="font-size:13px;line-height:1.6">Parolingizni tiklash uchun quyidagi tugmani bosing. Havola 1 soat amal qiladi.</p>
         <a href="${resetUrl}" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Parolni tiklash</a>
         <p style="font-size:11px;color:#888;margin-top:16px;word-break:break-all">${resetUrl}</p>`
      ),
      text: `Parolni tiklash: ${resetUrl}`,
    });
    if (!isEmailConfigured()) {
      console.log(`[auth] Parol tiklash havolasi (${email}): ${resetUrl}`);
    }
  }

  res.json({
    ok: true,
    message: "Agar bu email ro'yxatdan o'tgan bo'lsa, tiklash havolasi yuborildi",
  });
});

/** Token bilan yangi parol o'rnatish */
authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
    return;
  }
  const { token, password } = parsed.data;
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    res.status(400).json({ error: "Havola yaroqsiz yoki muddati tugagan" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
  });
  if (!user) {
    res.status(400).json({ error: "Foydalanuvchi topilmadi" });
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
  res.json({ ok: true, message: "Parol yangilandi — endi kirishingiz mumkin" });
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
    role: user.role,
    subscription: user.subscription,
    contributorBlocked: !!user.contributorBlockedAt,
  });
});

const profilePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" });
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
      error: "Stripe sozlanmagan — to‘lov hozir mavjud emas (local dev)",
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
      error: "Stripe sozlanmagan",
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
