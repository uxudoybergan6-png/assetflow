"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { AssetListItem } from "@creative-tools/shared";

interface MeResponse {
  subscription: { status: string; currentPeriodEnd: string | null } | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { apiToken?: string })?.apiToken;
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [subStatus, setSubStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        const [assetRes, me] = await Promise.all([
          apiFetch<{ items: AssetListItem[] }>(
            `/api/assets?search=${encodeURIComponent(search)}`
          ),
          apiFetch<MeResponse>("/api/auth/me", { token }),
        ]);
        setAssets(assetRes.items);
        setSubStatus(me.subscription?.status ?? "INCOMPLETE");
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, search]);

  async function downloadAsset(id: string) {
    if (!token) return;
    try {
      const { downloadUrl } = await apiFetch<{ downloadUrl: string }>(
        `/api/assets/${id}/download`,
        { method: "POST", token, body: JSON.stringify({ source: "web" }) }
      );
      window.open(downloadUrl, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Download failed — check subscription");
    }
  }

  async function openBillingPortal() {
    if (!token) return;
    const { url } = await apiFetch<{ url: string }>("/api/auth/portal", {
      method: "POST",
      token,
    });
    if (url) window.location.href = url;
  }

  if (status === "loading" || loading) {
    return <div className="p-20 text-center text-zinc-400">Loading...</div>;
  }

  const subActive = subStatus === "ACTIVE" || subStatus === "TRIALING";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-zinc-400 mb-8">
        Subscription:{" "}
        <span className={subActive ? "text-green-400" : "text-yellow-400"}>
          {subStatus}
        </span>
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="font-semibold mb-2">AE plugin</h2>
          <p className="text-sm text-zinc-400 mb-4">Bir tugma — token AE ga yoziladi.</p>
          <a
            href="/dashboard/contributor/settings"
            className="inline-block bg-[var(--accent)] px-4 py-2 rounded-lg text-sm text-black font-medium"
          >
            Ulash →
          </a>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="font-semibold mb-2">Contributor markazi</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Shablonlar, tasdiqlash navbati va platforma boshqaruvi (brauzer).
          </p>
          <a
            href="/contributor"
            className="inline-block border border-[var(--border)] px-4 py-2 rounded-lg text-sm hover:border-zinc-500"
          >
            Markazni ochish
          </a>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="font-semibold mb-2">Billing</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Manage subscription, payment method, invoices.
          </p>
          <button
            onClick={openBillingPortal}
            className="border border-[var(--border)] px-4 py-2 rounded-lg text-sm hover:border-zinc-500"
          >
            Open Billing Portal
          </button>
          {!subActive && (
            <a
              href="/pricing"
              className="block mt-3 text-[var(--accent)] text-sm"
            >
              Subscribe now →
            </a>
          )}
        </div>
      </div>

      <input
        type="search"
        placeholder="Search assets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 mb-6"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden"
          >
            <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs">
              {asset.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                asset.type
              )}
            </div>
            <div className="p-4">
              <h3 className="font-medium text-sm">{asset.title}</h3>
              <p className="text-xs text-zinc-500 mt-1">{asset.category}</p>
              <button
                onClick={() => downloadAsset(asset.id)}
                disabled={!subActive}
                className="mt-3 text-sm text-[var(--accent)] disabled:text-zinc-600"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
