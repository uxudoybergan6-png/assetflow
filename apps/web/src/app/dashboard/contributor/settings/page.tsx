"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, API_URL } from "@/lib/api";

export default function ContributorSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { apiToken?: string })?.apiToken;
  const role = (session?.user as { role?: string })?.role;
  const ok = role === "CONTRIBUTOR" || role === "ADMIN";

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/dashboard/contributor/settings");
    if (status === "authenticated" && !ok) router.push("/dashboard");
  }, [status, ok, router]);

  async function linkAE() {
    if (!token) return;
    setBusy(true);
    setMsg("");
    try {
      const { token: pluginToken } = await apiFetch<{ token: string }>("/api/plugin/token", {
        method: "POST",
        token,
      });
      await apiFetch("/api/plugin/apply-ae-prefs", {
        method: "POST",
        token,
        body: JSON.stringify({ apiBaseUrl: API_URL, token: pluginToken }),
      });
      setMsg("Tayyor. AE da Browse/Contributor panelni qayta oching.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <div className="p-20 text-center text-zinc-400">…</div>;

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-sm text-[var(--accent)]">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">AE plugin</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Shablonlar kompyuteringizda saqlanadi. Cloud — faqat Contributor paneldagi ☁ tugmasi
        orqali serverga yuborish.
      </p>
      {msg && <p className="mb-4 text-sm text-green-400">{msg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={linkAE}
        className="w-full bg-[var(--accent)] text-black font-semibold py-3 rounded-xl"
      >
        After Effects ga ulash
      </button>
    </div>
  );
}
