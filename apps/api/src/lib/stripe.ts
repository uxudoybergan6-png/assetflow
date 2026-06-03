import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/** Stripe faqat STRIPE_SECRET_KEY bo‘lsa ishlaydi — local dev Contributor panel uchun kalitsiz. */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return !!key && key.startsWith("sk_");
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe sozlanmagan. .env ga STRIPE_SECRET_KEY qo‘shing (yoki faqat Contributor/API ishlating)."
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

export function getPriceIds() {
  return {
    monthly: process.env.STRIPE_PRICE_MONTHLY ?? "",
    yearly: process.env.STRIPE_PRICE_YEARLY ?? "",
  };
}
