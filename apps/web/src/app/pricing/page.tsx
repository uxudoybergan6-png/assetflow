"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function PricingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(plan: "monthly" | "yearly") {
    const token = (session as { apiToken?: string })?.apiToken;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(plan);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/auth/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ plan }),
      });
      if (url) window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-bold text-center mb-4">Simple pricing</h1>
      <p className="text-zinc-400 text-center mb-12">
        Full access to 5,000+ assets. Cancel anytime.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-2">Monthly</h2>
          <p className="text-4xl font-bold mb-1">
            $4.99<span className="text-lg text-zinc-400 font-normal">/mo</span>
          </p>
          <ul className="text-zinc-400 text-sm space-y-2 my-6">
            <li>✓ Premiere Pro plugin</li>
            <li>✓ After Effects plugin</li>
            <li>✓ Unlimited downloads</li>
            <li>✓ New assets weekly</li>
          </ul>
          <button
            onClick={() => checkout("monthly")}
            disabled={loading === "monthly"}
            className="w-full bg-[var(--accent)] py-3 rounded-xl font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading === "monthly" ? "Loading..." : "Subscribe Monthly"}
          </button>
        </div>

        <div className="bg-[var(--card)] border-2 border-[var(--accent)] rounded-2xl p-8 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-xs px-3 py-1 rounded-full">
            Best value
          </span>
          <h2 className="text-xl font-semibold mb-2">Yearly</h2>
          <p className="text-4xl font-bold mb-1">
            $39.99<span className="text-lg text-zinc-400 font-normal">/yr</span>
          </p>
          <p className="text-sm text-green-400 mb-4">Save 33% vs monthly</p>
          <ul className="text-zinc-400 text-sm space-y-2 my-6">
            <li>✓ Everything in Monthly</li>
            <li>✓ Priority support</li>
            <li>✓ Early access to new packs</li>
          </ul>
          <button
            onClick={() => checkout("yearly")}
            disabled={loading === "yearly"}
            className="w-full bg-[var(--accent)] py-3 rounded-xl font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading === "yearly" ? "Loading..." : "Subscribe Yearly"}
          </button>
        </div>
      </div>
    </div>
  );
}
