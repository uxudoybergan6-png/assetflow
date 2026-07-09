import { sendEmail, renderEmailLayout } from "./email.js";
import { getWebUrl } from "./app-urls.js";

/**
 * FAZA 3 (E) — bildirishnoma bo'shliqlari: welcome / to'lov / admin-notify emaillari.
 * HAMMASI best-effort va non-blocking: sendEmail o'zi throw qilmaydi (false qaytaradi),
 * bu yerdagi har helper ham to'liq try/catch — chaqiruvchi so'rov HECH QACHON bloklanmaydi
 * yoki yiqilmaydi. RESEND_API_KEY yo'q bo'lsa sendEmail log'lab false qaytaradi (dev no-op).
 */

function safe(fn: () => Promise<unknown>, label: string): void {
  void fn().catch((e) => console.warn(`[notify] ${label} yuborilmadi:`, e));
}

/** Ro'yxatdan o'tish yakunlangach (email tasdiqlandi yoki Google orqali yangi user). */
export function sendWelcomeEmail(to: string, name?: string | null): void {
  safe(async () => {
    const who = name?.trim() ? `, ${name.trim()}` : "";
    await sendEmail({
      to,
      subject: "Welcome to FrameFlow 🎬",
      html: renderEmailLayout(
        `Welcome${who}!`,
        `<p style="font-size:13px;line-height:1.6">Your FrameFlow account is ready. Here's what you can do:</p>
         <ul style="font-size:13px;line-height:1.8;padding-left:18px;margin:8px 0">
           <li>Browse and import templates right inside After Effects</li>
           <li>Generate images, video, voiceover and SFX with Studio Gen AI</li>
           <li>Manage your plan and credits from the web dashboard</li>
         </ul>
         <a href="${getWebUrl()}" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Open FrameFlow</a>`
      ),
      text: `Welcome to FrameFlow! Open your dashboard: ${getWebUrl()}`,
    });
  }, `welcome (${to})`);
}

/** Obuna faollashdi (LS subscription_created / resumed). */
export function sendSubscriptionActiveEmail(to: string, planLabel: string): void {
  safe(async () => {
    await sendEmail({
      to,
      subject: `FrameFlow — your ${planLabel} subscription is active`,
      html: renderEmailLayout(
        "Subscription active",
        `<p style="font-size:13px;line-height:1.6">Thank you! Your <b>${planLabel}</b> subscription is now active. Pro features and credits are available in the plugin and on the web.</p>
         <p style="font-size:12px;color:#aaa">You can manage or cancel your subscription any time from the billing page.</p>`
      ),
      text: `Your FrameFlow ${planLabel} subscription is active.`,
    });
  }, `subscription-active (${to})`);
}

/** Muvaffaqiyatli davriy to'lov (LS subscription_payment_success — renewal receipt). */
export function sendPaymentReceivedEmail(to: string, amountLabel?: string): void {
  safe(async () => {
    await sendEmail({
      to,
      subject: "FrameFlow — payment received",
      html: renderEmailLayout(
        "Payment received",
        `<p style="font-size:13px;line-height:1.6">We've received your subscription payment${
          amountLabel ? ` of <b>${amountLabel}</b>` : ""
        }. Your plan continues uninterrupted — thank you!</p>`
      ),
      text: `FrameFlow: subscription payment received${amountLabel ? ` (${amountLabel})` : ""}.`,
    });
  }, `payment-received (${to})`);
}

/** To'lov muvaffaqiyatsiz (LS subscription_payment_failed) — harakat talab qilinadi. */
export function sendPaymentFailedEmail(to: string): void {
  safe(async () => {
    await sendEmail({
      to,
      subject: "FrameFlow — payment failed, action needed",
      html: renderEmailLayout(
        "Payment failed",
        `<p style="font-size:13px;line-height:1.6">Your latest subscription payment didn't go through. Please update your payment method to keep your plan active — otherwise it may be downgraded automatically.</p>
         <p style="font-size:12px;color:#aaa">Payments are retried automatically a few times before the subscription lapses.</p>`
      ),
      text: "FrameFlow: your subscription payment failed — please update your payment method.",
    });
  }, `payment-failed (${to})`);
}

/** FAZA 4 (B) — refund qayta ishlandi (LS order_refunded / subscription_payment_refunded). */
export function sendRefundProcessedEmail(
  to: string,
  opts: { amountLabel?: string; creditsClawed?: number; downgraded?: boolean } = {}
): void {
  safe(async () => {
    const bits: string[] = [
      `<p style="font-size:13px;line-height:1.6">Your refund${
        opts.amountLabel ? ` of <b>${opts.amountLabel}</b>` : ""
      } has been processed by our payment provider.</p>`,
    ];
    if (opts.creditsClawed && opts.creditsClawed > 0) {
      bits.push(
        `<p style="font-size:13px;line-height:1.6">The <b>${opts.creditsClawed}</b> unused credits from the refunded pack were removed from your balance. Credits you already spent are unaffected.</p>`
      );
    }
    if (opts.downgraded) {
      bits.push(
        `<p style="font-size:13px;line-height:1.6">Your subscription has been cancelled and your account moved to the <b>Free</b> plan.</p>`
      );
    }
    await sendEmail({
      to,
      subject: "FrameFlow — refund processed",
      html: renderEmailLayout("Refund processed", bits.join("")),
      text: `FrameFlow: your refund${opts.amountLabel ? ` (${opts.amountLabel})` : ""} has been processed.`,
    });
  }, `refund-processed (${to})`);
}

/** Kredit paketi xaridi (LS order_created, credit topup). */
export function sendCreditsToppedUpEmail(to: string, credits: number): void {
  safe(async () => {
    await sendEmail({
      to,
      subject: `FrameFlow — ${credits} credits added`,
      html: renderEmailLayout(
        "Credits added",
        `<p style="font-size:13px;line-height:1.6"><b>${credits}</b> AI credits have been added to your account. They're available immediately in Studio Gen.</p>`
      ),
      text: `FrameFlow: ${credits} AI credits added to your account.`,
    });
  }, `credits-topup (${to})`);
}

/**
 * Admin-notify: yangi shablon(lar) moderatsiyaga tushdi. ADMIN_NOTIFY_EMAIL env'i
 * bo'lmasa — jim no-op. count>1 (bulk ingest) uchun bitta jamlama xat.
 */
export function notifyAdminNewSubmission(input: {
  count: number;
  names: string[];
  contributorEmail?: string | null;
}): void {
  const admin = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!admin || input.count < 1) return;
  safe(async () => {
    const list = input.names
      .slice(0, 10)
      .map((n) => `<li>${n}</li>`)
      .join("");
    const more = input.count > 10 ? `<p style="font-size:12px;color:#aaa">…and ${input.count - 10} more</p>` : "";
    await sendEmail({
      to: admin,
      subject: `FrameFlow moderation — ${input.count} new template${input.count > 1 ? "s" : ""} pending`,
      html: renderEmailLayout(
        "New template pending moderation",
        `<p style="font-size:13px;line-height:1.6">${
          input.contributorEmail ? `<b>${input.contributorEmail}</b>` : "A contributor"
        } submitted ${input.count} template${input.count > 1 ? "s" : ""}:</p>
         <ul style="font-size:13px;line-height:1.8;padding-left:18px;margin:8px 0">${list}</ul>${more}
         <a href="${getWebUrl()}/admin/" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Open moderation</a>`
      ),
      text: `FrameFlow: ${input.count} new template${input.count > 1 ? "s" : ""} pending moderation (${input.names.slice(0, 10).join(", ")}).`,
    });
  }, `admin-new-submission (${input.count})`);
}

/**
 * PROBLEM 14 — Admin-notify: YANGI foydalanuvchi ro'yxatdan o'tdi. Faqat User
 * qatori YARATILGANDA chaqiriladi (returning-login'da EMAS). ADMIN_NOTIFY_EMAIL
 * yo'q bo'lsa — jim no-op. Fire-and-forget (safe) — signup'ni hech qachon buzmaydi.
 */
export function notifyAdminNewUser(input: {
  email: string;
  name?: string | null;
  source: "web" | "google-web" | "google-plugin";
}): void {
  const admin = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!admin || !input.email) return;
  safe(async () => {
    const sourceLabel =
      input.source === "google-web"
        ? "Google sign-in (web)"
        : input.source === "google-plugin"
          ? "Google sign-in (plugin)"
          : "Email registration (web)";
    await sendEmail({
      to: admin,
      subject: `FrameFlow — new user: ${input.email}`,
      html: renderEmailLayout(
        "New user signed up",
        `<p style="font-size:13px;line-height:1.6">A new user just joined FrameFlow:</p>
         <ul style="font-size:13px;line-height:1.8;padding-left:18px;margin:8px 0">
           <li><b>${input.email}</b>${input.name ? ` (${input.name})` : ""}</li>
           <li>Source: ${sourceLabel}</li>
           <li>Time: ${new Date().toISOString()}</li>
         </ul>
         <a href="${getWebUrl()}/admin/" style="display:inline-block;margin-top:12px;background:#82c341;color:#111;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">Open admin</a>`
      ),
      text: `FrameFlow: new user ${input.email}${input.name ? ` (${input.name})` : ""} via ${sourceLabel}.`,
    });
  }, `admin-new-user (${input.email})`);
}
