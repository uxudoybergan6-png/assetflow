"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type {
  ContributorPlatformSettings,
  ContributorTemplateItem,
  TemplateReviewStatus,
} from "@creative-tools/shared";

const STATUS_LABEL: Record<TemplateReviewStatus, string> = {
  DRAFT: "Qoralama",
  PENDING_REVIEW: "Tasdiqlash kutilmoqda",
  APPROVED: "Tasdiqlangan",
  REJECTED: "Rad etilgan",
};

const STATUS_CLASS: Record<TemplateReviewStatus, string> = {
  DRAFT: "text-zinc-400 border-zinc-600",
  PENDING_REVIEW: "text-amber-400 border-amber-600/50",
  APPROVED: "text-green-400 border-green-600/50",
  REJECTED: "text-red-400 border-red-600/50",
};

function ContributorCenterContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (session as { apiToken?: string })?.apiToken;
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "ADMIN";
  const isContributor = role === "CONTRIBUTOR" || isAdmin;

  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"templates" | "moderation" | "settings">(
    tabParam === "settings"
      ? "settings"
      : tabParam === "moderation" && isAdmin
        ? "moderation"
        : "templates"
  );

  const [templates, setTemplates] = useState<ContributorTemplateItem[]>([]);
  const [moderation, setModeration] = useState<ContributorTemplateItem[]>([]);
  const [settings, setSettings] = useState<ContributorPlatformSettings | null>(
    null
  );
  const [settingsForm, setSettingsForm] = useState({
    apiBaseUrl: "",
    requireApproval: true,
    defaultNav: "video",
    defaultRes: "4k",
    defaultOrient: "horizontal",
    contributorInstructions: "",
  });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/contributor");
    if (status === "authenticated" && !isContributor) router.push("/dashboard");
  }, [status, isContributor, router]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch<{ items: ContributorTemplateItem[] }>(
      "/api/contributor/templates?scope=mine",
      { token }
    );
    setTemplates(res.items);
  }, [token]);

  const loadModeration = useCallback(async () => {
    if (!token || !isAdmin) return;
    const res = await apiFetch<{ items: ContributorTemplateItem[] }>(
      "/api/contributor/templates?scope=moderation",
      { token }
    );
    setModeration(res.items);
  }, [token, isAdmin]);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch<ContributorPlatformSettings>(
      "/api/contributor/settings",
      { token }
    );
    setSettings(res);
    setSettingsForm({
      apiBaseUrl: res.apiBaseUrl ?? "",
      requireApproval: res.requireApproval,
      defaultNav: res.defaultNav,
      defaultRes: res.defaultRes,
      defaultOrient: res.defaultOrient,
      contributorInstructions: res.contributorInstructions ?? "",
    });
  }, [token]);

  useEffect(() => {
    if (!token || !isContributor) return;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadTemplates(), loadModeration(), loadSettings()]);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Yuklash xato");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isContributor, loadTemplates, loadModeration, loadSettings]);

  async function submitForReview(id: string) {
    if (!token) return;
    await apiFetch(`/api/contributor/templates/${id}/submit`, {
      method: "POST",
      token,
    });
    setMsg("Tasdiqlash uchun yuborildi");
    await loadTemplates();
    await loadModeration();
  }

  async function reviewTemplate(
    id: string,
    action: "approve" | "reject",
    note?: string
  ) {
    if (!token) return;
    await apiFetch(`/api/contributor/templates/${id}/review`, {
      method: "POST",
      token,
      body: JSON.stringify({ action, note, published: action === "approve" }),
    });
    setMsg(action === "approve" ? "Tasdiqlandi" : "Rad etildi");
    await loadModeration();
    await loadTemplates();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !isAdmin) return;
    await apiFetch("/api/contributor/settings", {
      method: "PATCH",
      token,
      body: JSON.stringify({
        apiBaseUrl: settingsForm.apiBaseUrl || null,
        requireApproval: settingsForm.requireApproval,
        defaultNav: settingsForm.defaultNav,
        defaultRes: settingsForm.defaultRes,
        defaultOrient: settingsForm.defaultOrient,
        contributorInstructions: settingsForm.contributorInstructions,
      }),
    });
    setMsg("Sozlamalar saqlandi");
    await loadSettings();
  }

  if (status === "loading" || loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center text-zinc-400">
        Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Contributor markazi</h1>
          <p className="text-zinc-400 text-sm">
            Shablonlarni boshqarish va tasdiqlash — brauzerda umumiy boshqaruv
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {msg && (
        <div className="mb-6 text-sm px-4 py-3 rounded-lg border border-[var(--border-accent)] bg-green-950/30 text-green-300">
          {msg}
          <button
            type="button"
            className="ml-3 text-zinc-500"
            onClick={() => setMsg("")}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-8 border-b border-[var(--border)] pb-2">
        {(
          [
            ["templates", "Mening shablonlarim"],
            ...(isAdmin ? [["moderation", "Tasdiqlash markazi"] as const] : []),
            ["settings", "Sozlamalar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === key
                ? "bg-[var(--accent)] text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {label}
            {key === "moderation" && moderation.length > 0 && (
              <span className="ml-2 bg-amber-500 text-black text-xs px-1.5 rounded-full">
                {moderation.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <section>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mb-6">
            <h2 className="font-semibold mb-2">AE Contributor panel</h2>
            <p className="text-sm text-zinc-400 mb-3">
              Shablonlarni After Effects ichida yuklang, keyin bu yerda tasdiqlash
              uchun yuboring. Cloud API:{" "}
              <code className="text-xs bg-black/40 px-1 rounded">
                {settings?.apiBaseUrl ||
                  process.env.NEXT_PUBLIC_API_URL ||
                  "http://localhost:4000"}
              </code>
            </p>
            <Link
              href="/dashboard/contributor/settings"
              className="text-sm text-[var(--accent)]"
            >
              Contributor ulanish sozlamalari →
            </Link>
          </div>

          {templates.length === 0 ? (
            <p className="text-zinc-500 text-sm">Hali shablon yo‘q.</p>
          ) : (
            <ul className="space-y-3">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {t.catLabel} · {t.res.toUpperCase()} · {t.templateApp.toUpperCase()}
                      {t.fileName ? ` · ${t.fileName}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${STATUS_CLASS[t.reviewStatus]}`}
                    >
                      {STATUS_LABEL[t.reviewStatus]}
                    </span>
                    {(t.reviewStatus === "DRAFT" ||
                      t.reviewStatus === "REJECTED") && (
                      <button
                        type="button"
                        onClick={() => submitForReview(t.id)}
                        className="text-xs bg-[var(--accent)] text-black px-3 py-1.5 rounded-lg font-medium"
                      >
                        Tasdiqlashga yuborish
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "moderation" && isAdmin && (
        <section>
          <h2 className="font-semibold mb-4">Tasdiqlash navbati</h2>
          {moderation.length === 0 ? (
            <p className="text-zinc-500 text-sm">Kutilayotgan shablon yo‘q.</p>
          ) : (
            <ul className="space-y-4">
              {moderation.map((t) => (
                <li
                  key={t.id}
                  className="bg-[var(--card)] border border-amber-600/30 rounded-xl p-5"
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <div>
                      <div className="font-semibold text-lg">{t.name}</div>
                      <div className="text-xs text-zinc-500">
                        {t.contributor?.email ?? t.contributorId} ·{" "}
                        {new Date(t.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs text-amber-400 border border-amber-600/50 px-2 py-1 rounded h-fit">
                      Kutilmoqda
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    {t.description || "Tavsif yo‘q"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => reviewTemplate(t.id, "approve")}
                      className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg"
                    >
                      Tasdiqlash
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const note = prompt("Rad etish sababi (ixtiyoriy):");
                        reviewTemplate(t.id, "reject", note ?? undefined);
                      }}
                      className="border border-red-600/50 text-red-400 text-sm px-4 py-2 rounded-lg"
                    >
                      Rad etish
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "settings" && (
        <section>
          <h2 className="font-semibold mb-4">Platforma sozlamalari</h2>
          {!isAdmin ? (
            <div className="text-sm text-zinc-400 space-y-2">
              <p>Faqat admin platforma sozlamalarini o‘zgartira oladi.</p>
              <p>
                Tasdiqlash talab qilinadi:{" "}
                <strong>{settings?.requireApproval ? "Ha" : "Yo‘q"}</strong>
              </p>
              <p>Default: {settings?.defaultRes} · {settings?.defaultOrient}</p>
              <Link
                href="/dashboard/contributor/settings"
                className="text-[var(--accent)] block mt-4"
              >
                CEP ulanish sozlamalari →
              </Link>
            </div>
          ) : (
            <form
              onSubmit={saveSettings}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4 max-w-xl"
            >
              <label className="block text-sm">
                <span className="text-zinc-400">API manzil (CEP cloud)</span>
                <input
                  className="mt-1 w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2"
                  value={settingsForm.apiBaseUrl}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      apiBaseUrl: e.target.value,
                    }))
                  }
                  placeholder="http://localhost:4000"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settingsForm.requireApproval}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      requireApproval: e.target.checked,
                    }))
                  }
                />
                Tasdiqlash majburiy (admin tasdiqlamasdan Browse da ko‘rinmasin)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="text-zinc-400">Default nav</span>
                  <input
                    className="mt-1 w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2"
                    value={settingsForm.defaultNav}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, defaultNav: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Res</span>
                  <input
                    className="mt-1 w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2"
                    value={settingsForm.defaultRes}
                    onChange={(e) =>
                      setSettingsForm((f) => ({ ...f, defaultRes: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-zinc-400">Orient</span>
                  <input
                    className="mt-1 w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2"
                    value={settingsForm.defaultOrient}
                    onChange={(e) =>
                      setSettingsForm((f) => ({
                        ...f,
                        defaultOrient: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-zinc-400">Contributor ko‘rsatma</span>
                <textarea
                  className="mt-1 w-full bg-black/30 border border-[var(--border)] rounded-lg px-3 py-2 min-h-[100px]"
                  value={settingsForm.contributorInstructions}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      contributorInstructions: e.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                className="bg-[var(--accent)] text-black px-5 py-2 rounded-lg font-medium"
              >
                Saqlash
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

export default function ContributorCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-6 py-20 text-center text-zinc-400">
          Yuklanmoqda…
        </div>
      }
    >
      <ContributorCenterContent />
    </Suspense>
  );
}
