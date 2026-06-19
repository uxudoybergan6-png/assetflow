import { Router } from "express";
import type { Request, Response } from "express";
import Stripe from "stripe";
import { prisma, SubscriptionStatus } from "@creative-tools/database";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";
import { syncPluginPlanFromStripe } from "../lib/plugin-profile.js";

export const stripeRouter = Router();

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    unpaid: "PAST_DUE",
    paused: "CANCELED",
  };
  return map[status] ?? "INCOMPLETE";
}

function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const end = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return end ? new Date(end * 1000) : null;
}

async function upsertSubscription(
  userId: string,
  sub: Stripe.Subscription
) {
  const periodEnd = getPeriodEnd(sub);
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripePriceId: sub.items.data[0]?.price.id,
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

/** Subscription qatorini VA PluginProfile.plan'ni Stripe holatiga sinxronlash —
    yagona haqiqat manbai. ACTIVE/TRIALING → PRO, aks holda → FREE. */
async function syncSubscriptionAndPlan(userId: string, sub: Stripe.Subscription) {
  await upsertSubscription(userId, sub);
  const status = mapStripeStatus(sub.status);
  const isActive =
    status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;
  await syncPluginPlanFromStripe(userId, isActive);
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured() || !webhookSecret) {
    res.status(503).json({ error: "Stripe webhook not configured" });
    return;
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: `Webhook Error: ${message}` });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        await syncSubscriptionAndPlan(userId, sub);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: sub.customer as string },
      });
      if (user) {
        // Tartibsiz/eski yetkazishda eskirgan "active" payload PRO'ni noto'g'ri
        // tiklab yubormasligi uchun jonli holatni Stripe'dan qayta o'qiymiz
        // (deleted bo'lgan obuna retrieve'da 'canceled' qaytadi → FREE).
        // To'liq event-id dedup #16'da.
        const fresh = await stripe.subscriptions.retrieve(sub.id);
        await syncSubscriptionAndPlan(user.id, fresh);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: sub.customer as string },
      });
      if (user) {
        await prisma.subscription.update({
          where: { userId: user.id },
          data: { status: "CANCELED", cancelAtPeriodEnd: false },
        });
        // Obuna o'chdi → PluginProfile.plan ham FREE'ga tushadi (PRO abadiy qolmaydi).
        await syncPluginPlanFromStripe(user.id, false);
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}
