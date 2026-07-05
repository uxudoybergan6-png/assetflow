import { Router } from "express";
import { z } from "zod";
import { prisma, PluginPlanTier } from "@creative-tools/database";
import { requireAuth } from "../middleware/auth.js";
import { getWebUrl } from "../lib/app-urls.js";
import {
  isLemonSqueezyConfigured,
  getLemonSqueezyStoreId,
  findSubscriptionVariant,
  findCreditVariant,
  createCheckout,
} from "../lib/lemonsqueezy.js";

/**
 * FAOL to'lov yo'li = Lemon Squeezy (MoR). Bu router platforma "Rejani
 * o'zgartirish" (obuna: pro/studio) va "Kredit qo'shish" (bir martalik paket)
 * tugmalari uchun hosted checkout URL qaytaradi. Stripe kodi o'chirilmadi —
 * lekin app endi shu yo'ldan o'tadi.
 */
export const billingRouter = Router();

const checkoutSchema = z
  .object({
    plan: z.enum(["pro", "studio"]).optional(),
    credits: z.number().int().positive().optional(),
  })
  .refine((v) => !!v.plan || !!v.credits, {
    message: "plan (pro/studio) or credits (package amount) is required",
  });

billingRouter.post("/checkout", requireAuth, async (req, res) => {
  if (!isLemonSqueezyConfigured()) {
    res.status(503).json({
      error: "Billing is not configured yet",
      code: "BILLING_NOT_CONFIGURED",
    });
    return;
  }
  if (!getLemonSqueezyStoreId()) {
    res.status(503).json({
      error: "Billing store is not configured (LEMONSQUEEZY_STORE_ID)",
      code: "BILLING_STORE_MISSING",
    });
    return;
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    // Variantni jonli aniqlaymiz (ID hardcode YO'Q — nomdan xaritalanadi).
    const variant = parsed.data.plan
      ? await findSubscriptionVariant(
          parsed.data.plan === "studio" ? PluginPlanTier.STUDIO : PluginPlanTier.PRO
        )
      : await findCreditVariant(parsed.data.credits!);

    if (!variant) {
      res.status(400).json({
        error: parsed.data.plan
          ? `No variant found for the "${parsed.data.plan}" plan (create a product in the Lemon Squeezy store)`
          : `Credit package for ${parsed.data.credits} not found`,
        code: "VARIANT_NOT_FOUND",
      });
      return;
    }

    const url = await createCheckout({
      variantId: variant.variantId,
      userId: user.id,
      email: user.email,
      name: user.name,
      redirectUrl: `${getWebUrl()}/?billing=success`,
    });

    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[billing/checkout]", message);
    res.status(502).json({ error: "Could not create checkout", code: "CHECKOUT_FAILED" });
  }
});
