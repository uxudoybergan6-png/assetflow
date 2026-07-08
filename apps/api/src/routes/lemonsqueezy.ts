import type { Request, Response } from "express";
import { prisma, PluginPlanTier } from "@creative-tools/database";
import {
  verifyWebhookSignature,
  webhookDedupeKey,
  classifyVariant,
} from "../lib/lemonsqueezy.js";
import {
  applyBillingPlan,
  grantAiCreditsTopup,
  clawbackTopupCredits,
} from "../lib/plugin-profile.js";
import { lsAmountCents, recordRevenueEvent } from "../lib/revenue.js";
import {
  sendSubscriptionActiveEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendCreditsToppedUpEmail,
  sendRefundProcessedEmail,
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

/**
 * FAZA 4 (B) — dunning/risk holatini belgilash/tozalash (faqat KO'RSATKICH,
 * kirish gate'lariga tegmaydi; ular plan/status orqali mavjud oqimlarda hal bo'ladi).
 * Idempotent — bir xil qiymat qayta yozilsa natija o'zgarmaydi. Best-effort.
 */
async function setBillingIssue(userId: string, issue: string | null): Promise<void> {
  try {
    await prisma.pluginProfile.updateMany({
      where: { userId },
      data: { billingIssue: issue, billingIssueAt: issue ? new Date() : null },
    });
  } catch (e) {
    console.warn("[ls-webhook] billingIssue yozilmadi:", e);
  }
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
  // FAZA 4 (B) — dunning ko'rsatkichi: past_due/unpaid → belgi; faol → toza.
  const status = String(attrs?.status ?? "");
  if (status === "past_due" || status === "unpaid") {
    await setBillingIssue(userId, status);
  } else if (status === "active" || status === "on_trial") {
    await setBillingIssue(userId, null);
  }
}

/**
 * FAZA 4 (B) — order refund (kredit-paket yoki obuna birinchi orderi):
 *   • manfiy RevenueEvent (idempotent sourceKey `...:refund`);
 *   • kredit-paket → SARFLANMAGAN top-up kreditni clawback (partial refund →
 *     proportsional floor); bepul oylik ulushga TEGILMAYDI;
 *   • obuna orderi refundi → FREE'ga tushirish (policy);
 *   • foydalanuvchiga email (best-effort, chaqiruvchida).
 * Idempotentlik: webhook claim-first (`ls:order:<id>:refunded`) + sourceKey unique.
 */
async function handleOrderRefunded(
  userId: string,
  orderId: string,
  attrs: Record<string, any>
): Promise<{ creditsClawed: number; downgraded: boolean; refundedCents: number }> {
  const totalCents = lsAmountCents(attrs, "total");
  const refundedRaw = lsAmountCents(attrs, "refunded_amount");
  const refundedCents = refundedRaw > 0 ? Math.min(refundedRaw, totalCents || refundedRaw) : totalCents;
  const fullRefund = totalCents > 0 ? refundedCents >= totalCents : true;

  const item = attrs?.first_order_item ?? {};
  const classified = classifyVariant(
    String(item?.product_name ?? ""),
    String(item?.variant_name ?? ""),
    String(item?.variant_id ?? "")
  );

  if (refundedCents > 0) {
    await recordRevenueEvent({
      sourceKey: `rev:order:${orderId}:refund`,
      userId,
      kind: "refund",
      // plan faqat obuna orderi refundida — pool bazasi (netSubscriptionRevenue)
      // obuna refundlarini shu belgi orqali ajratadi.
      plan: classified?.kind === "subscription" ? String(classified.plan) : null,
      grossCents: -refundedCents,
      taxCents: fullRefund ? -lsAmountCents(attrs, "tax") : 0, // partial'da soliq taqsimoti noma'lum
      currency: String(attrs?.currency ?? "USD"),
      lsOrderId: orderId,
      eventName: "order_refunded",
      occurredAt: lsOccurredAt(attrs),
    });
  }

  let creditsClawed = 0;
  let downgraded = false;
  if (classified?.kind === "credit") {
    // Partial refund → proportsional kredit (floor); to'liq → butun paket.
    const want = fullRefund || totalCents <= 0
      ? classified.credits
      : Math.floor((classified.credits * refundedCents) / totalCents);
    creditsClawed = (await clawbackTopupCredits(userId, want)).clawed;
  } else if (classified?.kind === "subscription" && fullRefund) {
    await applyBillingPlan(userId, PluginPlanTier.FREE);
    downgraded = true;
  }
  return { creditsClawed, downgraded, refundedCents };
}

/**
 * FAZA 4 (B) — obuna to'lovi refundi (subscription_payment_refunded):
 * manfiy RevenueEvent + FREE'ga tushirish (policy). Obuna to'lovi top-up kredit
 * BERMAGAN — clawback yo'q (bepul oylik ulushga tegilmaydi; FREE cap'ini
 * applyBillingPlan o'zi idempotent bajaradi).
 */
async function handleInvoiceRefunded(
  userId: string,
  invoiceId: string,
  attrs: Record<string, any>
): Promise<{ refundedCents: number }> {
  const refundedRaw = lsAmountCents(attrs, "refunded_amount");
  const totalCents = lsAmountCents(attrs, "total");
  const refundedCents = refundedRaw > 0 ? Math.min(refundedRaw, totalCents || refundedRaw) : totalCents;
  if (refundedCents > 0) {
    await recordRevenueEvent({
      sourceKey: `rev:invoice:${invoiceId}:refund`,
      userId,
      kind: "refund",
      grossCents: -refundedCents,
      taxCents: refundedCents >= totalCents ? -lsAmountCents(attrs, "tax") : 0,
      currency: String(attrs?.currency ?? "USD"),
      lsInvoiceId: invoiceId,
      lsSubscriptionId: attrs?.subscription_id != null ? String(attrs.subscription_id) : null,
      eventName: "subscription_payment_refunded",
      occurredAt: lsOccurredAt(attrs),
    });
  }
  await applyBillingPlan(userId, PluginPlanTier.FREE);
  return { refundedCents };
}

/** LS payload'idan hodisa vaqti (created_at) — bo'lmasa hozir. */
function lsOccurredAt(attrs: Record<string, any>): Date {
  const t = attrs?.created_at ? Date.parse(String(attrs.created_at)) : NaN;
  return Number.isFinite(t) ? new Date(t) : new Date();
}

async function handleOrderCreated(userId: string, orderId: string, attrs: Record<string, any>) {
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
    // FAZA 4 (A) — kredit-paket tushumi. Obuna orderlari BU YERDA yozilmaydi
    // (subscription_payment_success invoice'i yozadi — double-count bo'lmasin).
    await recordRevenueEvent({
      sourceKey: `rev:order:${orderId}`,
      userId,
      kind: "credit_pack",
      grossCents: lsAmountCents(attrs, "total"),
      taxCents: lsAmountCents(attrs, "tax"),
      currency: String(attrs?.currency ?? "USD"),
      lsOrderId: orderId,
      eventName: "order_created",
      occurredAt: lsOccurredAt(attrs),
    });
  }
}

/**
 * FAZA 4 (A) — obuna to'lovi (subscription-invoice) tushumini yozish.
 * billing_reason: "initial" → subscription_initial, aks holda renewal.
 * Plan best-effort: invoice payload'ida mahsulot nomi yo'q — foydalanuvchining
 * joriy PluginProfile.plan'idan olinadi (subscription_created odatda oldinroq keladi).
 */
async function recordSubscriptionInvoiceRevenue(
  userId: string,
  invoiceId: string,
  attrs: Record<string, any>
) {
  const gross = lsAmountCents(attrs, "total");
  if (gross <= 0) return;
  let plan: string | null = null;
  try {
    const prof = await prisma.pluginProfile.findUnique({
      where: { userId },
      select: { plan: true },
    });
    if (prof && prof.plan !== PluginPlanTier.FREE) plan = String(prof.plan);
  } catch {
    /* plan best-effort */
  }
  await recordRevenueEvent({
    sourceKey: `rev:invoice:${invoiceId}`,
    userId,
    kind: String(attrs?.billing_reason ?? "") === "initial" ? "subscription_initial" : "renewal",
    plan,
    grossCents: gross,
    taxCents: lsAmountCents(attrs, "tax"),
    currency: String(attrs?.currency ?? "USD"),
    lsInvoiceId: invoiceId,
    lsSubscriptionId: attrs?.subscription_id != null ? String(attrs.subscription_id) : null,
    eventName: "subscription_payment_success",
    occurredAt: lsOccurredAt(attrs),
  });
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
  // FAZA 4 (B) — refund hodisalari ID bo'yicha kalitlanadi: LS retry payload'i
  // biroz farq qilsa ham (updated_at) clawback/downgrade IKKI marta ishlamaydi.
  const dedupeKey =
    eventName === "order_created" && dataId
      ? `ls:order:${dataId}`
      : eventName === "order_refunded" && dataId
        ? `ls:order:${dataId}:refunded`
        : eventName === "subscription_payment_refunded" && dataId
          ? `ls:invoice:${dataId}:refunded`
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
          await handleOrderCreated(userId, dataId, attrs);
          break;
        case "subscription_payment_success":
          // FAZA 4 (A) — real tushum yozuvi (holat o'zgarmaydi, faqat accounting).
          if (dataId) await recordSubscriptionInvoiceRevenue(userId, dataId, attrs);
          // FAZA 4 (B) — muvaffaqiyatli to'lov dunning belgisini tozalaydi.
          await setBillingIssue(userId, null);
          break;
        case "subscription_payment_failed":
          // FAZA 4 (B) — dunning: holat belgisi (grace/downgrade mavjud
          // subscription_updated/expired oqimida ends_at bo'yicha hal bo'ladi).
          // Foydalanuvchi emaili quyida notifyPaymentEvent'da (mavjud).
          await setBillingIssue(userId, "payment_failed");
          break;
        case "order_refunded": {
          if (!dataId) break;
          const r = await handleOrderRefunded(userId, dataId, attrs);
          const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
          if (u?.email && r.refundedCents > 0) {
            sendRefundProcessedEmail(u.email, {
              amountLabel: `$${(r.refundedCents / 100).toFixed(2)}`,
              creditsClawed: r.creditsClawed,
              downgraded: r.downgraded,
            });
          }
          break;
        }
        case "subscription_payment_refunded": {
          if (!dataId) break;
          const r = await handleInvoiceRefunded(userId, dataId, attrs);
          const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
          if (u?.email) {
            sendRefundProcessedEmail(u.email, {
              amountLabel: r.refundedCents > 0 ? `$${(r.refundedCents / 100).toFixed(2)}` : undefined,
              downgraded: true,
            });
          }
          break;
        }
        default:
          // FAZA 4 (B) — LS hozircha alohida dispute/chargeback webhook yubormaydi
          // (MoR sifatida o'zi hal qiladi); yuborsa defensiv qayd + hisob belgisi.
          if (/chargeback|dispute/.test(eventName)) {
            const total = lsAmountCents(attrs, "total");
            if (dataId && total > 0) {
              await recordRevenueEvent({
                sourceKey: `rev:${dataId}:chargeback`,
                userId,
                kind: "chargeback",
                grossCents: -total,
                currency: String(attrs?.currency ?? "USD"),
                eventName,
                occurredAt: lsOccurredAt(attrs),
              });
            }
            await setBillingIssue(userId, "chargeback");
          }
          // qolgan hodisalar holat o'zgartirmaydi — faqat quyidagi bildirishnoma.
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
