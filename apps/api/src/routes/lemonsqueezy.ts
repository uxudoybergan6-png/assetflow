import type { Request, Response } from "express";
import { prisma, PluginPlanTier } from "@creative-tools/database";
import {
  verifyWebhookSignature,
  webhookDedupeKey,
  classifyVariant,
} from "../lib/lemonsqueezy.js";
import { applyBillingPlan, grantAiCreditsTopup } from "../lib/plugin-profile.js";
import {
  sendSubscriptionActiveEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendCreditsToppedUpEmail,
} from "../lib/notify.js";

/**
 * Lemon Squeezy webhook — MoR to'lov hodisalarini qayta ishlaydi.
 *
 * XAVFSIZLIK / IDEMPOTENTLIK:
 *   • HMAC-SHA256 imzo tekshiruvi (X-Signature, RAW body, WEBHOOK_SECRET) —
 *     imzo noto'g'ri/sekret yo'q bo'lsa hech nima qilinmaydi (401/503).
 *   • CLAIM-FIRST dedup: side-effect'lardan OLDIN WebhookEvent qatorini yaratamiz
 *     (unique kalit). P2002 → allaqachon ishlangan/parallel yetkazish → skip.
 *     Bu ADDITIVE kredit grant'ini parallel takror yetkazishda ham EXACTLY-ONCE
 *     qiladi (Stripe check-then-create naqshidan farqli — chunki topup atomik EMAS
 *     idempotent). Ishlov XATO bersa claim o'chiriladi → LS retry qayta ishlaydi.
 *   • order_created uchun kalit = `ls:order:<orderId>` (har order bir marta grant);
 *     subscription_* uchun kalit = raw-body sha256 (literal retry deduped, haqiqiy
 *     holat o'zgarishi qayta ishlanadi — applyBillingPlan baribir idempotent).
 *
 * XARIDOR → APP-USER: checkout'da yuborilgan meta.custom_data.user_id orqali
 * (fallback: data.attributes.user_email). Faqat MAVJUD user'ga yoziladi.
 */

type WebhookBody = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> };
  data?: { id?: string; attributes?: Record<string, any> };
};

async function resolveUserId(body: WebhookBody): Promise<string | null> {
  const rawId = body?.meta?.custom_data?.user_id;
  if (typeof rawId === "string" && rawId) {
    const u = await prisma.user.findUnique({
      where: { id: rawId },
      select: { id: true },
    });
    if (u) return u.id;
  }
  // Fallback: xaridor emaili (bizning checkout'siz — masalan dashboard order).
  const email = body?.data?.attributes?.user_email;
  if (typeof email === "string" && email) {
    const u =
      (await prisma.user.findUnique({ where: { email }, select: { id: true } })) ??
      (await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
      }));
    if (u) return u.id;
  }
  return null;
}

/** Obuna hali faolmi (kirish beriladimi)? Stripe lapse mantig'iga mos:
    active/on_trial → faol; cancelled → grace (ends_at kelajakda) bo'lsa faol;
    expired/past_due/unpaid/paused → FREE. */
function subscriptionActive(attrs: Record<string, any> | undefined): boolean {
  const status = String(attrs?.status ?? "");
  if (status === "active" || status === "on_trial") return true;
  if (status === "cancelled") {
    const endsAt = attrs?.ends_at ? Date.parse(String(attrs.ends_at)) : NaN;
    return Number.isFinite(endsAt) && endsAt > Date.now();
  }
  return false;
}

async function handleSubscriptionEvent(userId: string, attrs: Record<string, any>) {
  // Plan payload'dan (product_name/variant_name) — variant xaritasiga BOG'LIQ EMAS.
  const classified = classifyVariant(
    String(attrs?.product_name ?? ""),
    String(attrs?.variant_name ?? ""),
    String(attrs?.variant_id ?? "")
  );
  const active = subscriptionActive(attrs);
  let target: PluginPlanTier;
  if (!active) {
    target = PluginPlanTier.FREE;
  } else if (classified?.kind === "subscription") {
    target = classified.plan;
  } else {
    // Faol obuna, lekin nom Pro/Studio'ga tushmadi — kamida PRO beramiz (baseline).
    console.warn("[ls-webhook] obuna varianti tanilmadi, PRO baseline:", attrs?.product_name);
    target = PluginPlanTier.PRO;
  }
  await applyBillingPlan(userId, target);
}

async function handleOrderCreated(userId: string, attrs: Record<string, any>) {
  // Obuna birinchi to'lovi HAM order_created yaratadi — faqat KREDIT-PAKET
  // orderlarida grant qilamiz (obuna plani subscription_* orqali beriladi).
  if (String(attrs?.status ?? "") !== "paid") return;
  const item = attrs?.first_order_item ?? {};
  const classified = classifyVariant(
    String(item?.product_name ?? ""),
    String(item?.variant_name ?? ""),
    String(item?.variant_id ?? "")
  );
  if (classified?.kind === "credit") {
    await grantAiCreditsTopup(userId, classified.credits, { reason: "topup" });
  }
}

/**
 * FAZA 3 (E) — to'lov bildirishnomalari (best-effort): obuna faollashdi / davriy to'lov
 * o'tdi / to'lov yiqildi / kredit topup. Ichkarida to'liq yutiladi — webhook ishlovini
 * HECH QACHON yiqitmaydi yoki kechiktirmaydi (email fire-and-forget).
 * Dedup claim-first bo'lgani uchun LS retry'da takror email ketmaydi.
 */
async function notifyPaymentEvent(
  userId: string,
  eventName: string,
  attrs: Record<string, any>
): Promise<void> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!u?.email) return;
    if (
      (eventName === "subscription_created" || eventName === "subscription_resumed") &&
      subscriptionActive(attrs)
    ) {
      const classified = classifyVariant(
        String(attrs?.product_name ?? ""),
        String(attrs?.variant_name ?? ""),
        String(attrs?.variant_id ?? "")
      );
      const label =
        classified?.kind === "subscription"
          ? String(classified.plan)
          : String(attrs?.product_name || "Pro");
      sendSubscriptionActiveEmail(u.email, label);
    } else if (eventName === "subscription_payment_success") {
      const amount =
        typeof attrs?.total_formatted === "string" ? attrs.total_formatted : undefined;
      sendPaymentReceivedEmail(u.email, amount);
    } else if (eventName === "subscription_payment_failed") {
      sendPaymentFailedEmail(u.email);
    } else if (eventName === "order_created" && String(attrs?.status ?? "") === "paid") {
      const item = attrs?.first_order_item ?? {};
      const classified = classifyVariant(
        String(item?.product_name ?? ""),
        String(item?.variant_name ?? ""),
        String(item?.variant_id ?? "")
      );
      if (classified?.kind === "credit") sendCreditsToppedUpEmail(u.email, classified.credits);
    }
  } catch (e) {
    console.warn("[ls-webhook] to'lov bildirishnomasi yuborilmadi:", e);
  }
}

export async function lemonSqueezyWebhookHandler(req: Request, res: Response) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "Lemon Squeezy webhook not configured" });
    return;
  }

  const rawBody = req.body as Buffer;
  const signature = req.headers["x-signature"] as string | undefined;
  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as WebhookBody;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const eventName =
    body?.meta?.event_name ??
    (req.headers["x-event-name"] as string | undefined) ??
    "";
  const dataId = body?.data?.id ? String(body.data.id) : "";
  const dedupeKey =
    eventName === "order_created" && dataId
      ? `ls:order:${dataId}`
      : webhookDedupeKey(rawBody);

  // CLAIM-FIRST: side-effect'lardan oldin dedup kalitini atomik egallaymiz.
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: dedupeKey, type: eventName || "lemonsqueezy" },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      res.json({ received: true, duplicate: true });
      return;
    }
    throw e;
  }

  try {
    const userId = await resolveUserId(body);
    const attrs = body?.data?.attributes ?? {};
    if (!userId) {
      console.warn("[ls-webhook] user aniqlanmadi:", eventName, body?.meta?.custom_data);
    } else {
      switch (eventName) {
        case "subscription_created":
        case "subscription_updated":
        case "subscription_resumed":
        case "subscription_cancelled":
        case "subscription_expired":
        case "subscription_paused":
        case "subscription_unpaused":
          await handleSubscriptionEvent(userId, attrs);
          break;
        case "order_created":
          await handleOrderCreated(userId, attrs);
          break;
        default:
          // subscription_payment_* holat o'zgartirmaydi — faqat quyidagi bildirishnoma.
          break;
      }
      // FAZA 3 (E) — foydalanuvchiga to'lov emaili (best-effort, ishlovdan KEYIN:
      // plan/kredit allaqachon qo'llangan; email xatosi claim'ni bekor qilmaydi).
      await notifyPaymentEvent(userId, eventName, attrs);
    }
  } catch (err) {
    // Ishlov xato berdi → claim'ni bekor qilamiz (LS retry qayta ishlasin,
    // grant yo'qolmasin). Best-effort delete.
    await prisma.webhookEvent
      .deleteMany({ where: { stripeEventId: dedupeKey } })
      .catch(() => {});
    throw err;
  }

  res.json({ received: true });
}
