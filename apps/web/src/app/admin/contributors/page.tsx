"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type {
  ContributorPlatformSettings,
  ContributorTemplateItem,
  TemplateReviewStatus,
} from "@creative-tools/shared";

type Tab = "overview" | "contributors" | "templates" | "moderation" | "settings";

interface ContributorRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  templateCount: number;
}

interface Overview {
  contributors: ContributorRow[];
  stats: {
    totalTemplates: number;
    pending: number;
    approved: number;
    rejected: number;
    draft: number;
  };
  recent: ContributorTemplateItem[];
}

const STATUS_UZ: Record<TemplateReviewStatus, string> = {
  DRAFT: "Qoralama",
  PENDING_REVIEW: "Kutilmoqda",
  APPROVED: "Tasdiqlangan",
  REJECTED: "Rad etilgan",
};

const STATUS_STYLE: Record<TemplateReviewStatus, string> = {
  DRAFT: "bg-zinc-800 text-zinc-300",
  PENDING_REVIEW: "bg-amber-950 text-amber-300 border border-amber-700/50",
  APPROVED: "bg-green-950 text-green-300 border border-green-700/50",
  REJECTED: "bg-red-950 text-red-300 border border-red-700/50",
};

function AdminContributorsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (session as { apiToken?: string })?.apiToken;
  const role = (session?.user as { role?: string })?.role;

  const initialTab = (searchParams.get("tab") as Tab) || "overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [templates, setTemplates] = useState<ContributorTemplateItem[]>([]);
  const [settings, setSettings] = useState<ContributorPlatformSettings | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterContributor, setFilterContributor] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin/contributors");
    }
    if (status === "authenticated" && role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, role, router]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<Overview>("/api/contributor/admin/overview", {
      token,
    });
    setOverview(data);
  }, [token]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    const q = new URLSearchParams({ scope: "all" });
    if (filterStatus) q.set("status", filterStatus);
    if (filterContributor) q.set("contributorId", filterContributor);
    if (search.trim()) q.set("search", search.trim());
    const res = await apiFetch<{ items: ContributorTemplateItem[] }>(
      `/api/contributor/templates?${q}`,
      { token }
    );
    setTemplates(res.items);
  }, [token, filterStatus, filterContributor, search]);

  const loadModeration = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch<{ items: ContributorTemplateItem[] }>(
      "/api/contributor/templates?scope=moderation",
      { token }
    );
    setTemplates(res.items);
  }, [token]);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch<ContributorPlatformSettings>(
      "/api/contributor/settings",
      { token }
    );
    setSettings(res);
  }, [token]);

  useEffect(() => {
    if (!token || role !== "ADMIN") return;
    (async () => {
      setLoading(true);
      try {
        await loadOverview();
        if (tab === "templates") await loadTemplates();
        if (tab === "moderation") await loadModeration();
        if (tab === "settings") await loadSettings();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Yuklash xato");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, role, tab, loadOverview, loadTemplates, loadModeration, loadSettings]);

  useEffect(() => {
    if (tab === "templates" && token) loadTemplates();
  }, [tab, filterStatus, filterContributor, search, token, loadTemplates]);

  async function review(id: string, action: "approve" | "reject") {
    if (!token) return;
    const note =
      action === "reject" ? prompt("Rad etish sababi (ixtiyoriy):") : undefined;
    await apiFetch(`/api/contributor/templates/${id}/review`, {
      method: "POST",
      token,
      body: JSON.stringify({ action, note: note ?? undefined, published: true }),
    });
    setMsg(action === "approve" ? "Tasdiqlandi" : "Rad etildi");
    await loadOverview();
    if (tab === "moderation") await loadModeration();
    if (tab === "templates") await loadTemplates();
  }

  async function deleteTemplate(id: string, name: string) {
    if (!token || !confirm(`«${name}» o‘chirilsinmi?`)) return;
    await apiFetch(`/api/contributor/templates/${id}`, { method: "DELETE", token });
    setMsg("O‘chirildi");
    await loadOverview();
    await loadTemplates();
  }

  async function setRole(userId: string, newRole: string) {
    if (!token) return;
    await apiFetch(`/api/contributor/users/${userId}/role`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role: newRole }),
    });
    setMsg("Rol yangilandi");
    await loadOverview();
  }

  function selectContributor(id: string) {
    setFilterContributor(id);
    setTab("templates");
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Umumiy" },
    { id: "contributors", label: "Contributorlar" },
    { id: "templates", label: "Barcha shablonlar" },
    {
      id: "moderation",
      label: "Tasdiqlash",
      badge: overview?.stats.pending,
    },
    { id: "settings", label: "Sozlamalar" },
  ];

  if (status === "loading" || (loading && !overview)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <header className="border-b border-[var(--border)] bg-[#0d0d10]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Admin boshqaruv
            </p>
            <h1 className="text-2xl font-bold">Contributor & shablonlar</h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin" className="text-zinc-400 hover:text-white">
              ← Admin
            </Link>
            <a
              href="/contributor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)]"
            >
              Contributor markazi ↗
            </a>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === t.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="ml-2 bg-amber-500 text-black text-xs px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {msg && (
          <div className="mb-6 text-sm px-4 py-3 rounded-lg border border-green-700/40 bg-green-950/40 text-green-300 flex justify-between">
            {msg}
            <button type="button" onClick={() => setMsg("")}>
              ×
            </button>
          </div>
        )}

        {tab === "overview" && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                ["Jami shablon", overview.stats.totalTemplates, "text-white"],
                ["Kutilmoqda", overview.stats.pending, "text-amber-400"],
                ["Tasdiqlangan", overview.stats.approved, "text-green-400"],
                ["Qoralama", overview.stats.draft, "text-zinc-400"],
                ["Rad", overview.stats.rejected, "text-red-400"],
              ].map(([label, val, cls]) => (
                <div
                  key={label}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                >
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className={`text-2xl font-bold mt-1 ${cls}`}>{val}</div>
                </div>
              ))}
            </div>

            <section>
              <h2 className="font-semibold mb-4">So‘nggi shablonlar</h2>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-zinc-500 text-left border-b border-[var(--border)]">
                    <tr>
                      <th className="p-3">Nomi</th>
                      <th className="p-3">Contributor</th>
                      <th className="p-3">Holat</th>
                      <th className="p-3">Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="p-3 font-medium">{t.name}</td>
                        <td className="p-3 text-zinc-400">
                          {t.contributor?.email ?? "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[t.reviewStatus]}`}
                          >
                            {STATUS_UZ[t.reviewStatus]}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-500 text-xs">
                          {new Date(t.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {tab === "contributors" && overview && (
          <section>
            <p className="text-sm text-zinc-400 mb-4">
              Contributor roli yoki kamida bitta shablon yuklagan foydalanuvchilar.
            </p>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-zinc-500 text-left border-b border-[var(--border)]">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Ism</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Shablonlar</th>
                    <th className="p-3">Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.contributors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500">
                        Hali contributor yo‘q. Admin → Users dan CONTRIBUTOR bering.
                      </td>
                    </tr>
                  ) : (
                    overview.contributors.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="p-3">{c.email}</td>
                        <td className="p-3">{c.name ?? "—"}</td>
                        <td className="p-3">
                          <select
                            value={c.role}
                            onChange={(e) => setRole(c.id, e.target.value)}
                            className="bg-black/40 border border-[var(--border)] rounded px-2 py-1 text-xs"
                          >
                            <option value="USER">USER</option>
                            <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="p-3">{c.templateCount}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => selectContributor(c.id)}
                            className="text-[var(--accent)] text-xs hover:underline"
                          >
                            Shablonlari →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(tab === "templates" || tab === "moderation") && (
          <section>
            {tab === "templates" && (
              <div className="flex flex-wrap gap-3 mb-6">
                <input
                  type="search"
                  placeholder="Shablon qidirish…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-w-[200px]"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Barcha holatlar</option>
                  {(Object.keys(STATUS_UZ) as TemplateReviewStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_UZ[s]}
                    </option>
                  ))}
                </select>
                <select
                  value={filterContributor}
                  onChange={(e) => setFilterContributor(e.target.value)}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm min-w-[180px]"
                >
                  <option value="">Barcha contributorlar</option>
                  {overview?.contributors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-zinc-500 text-sm">Shablon topilmadi.</p>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap gap-4 justify-between items-start"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-lg">{t.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {t.contributor?.email ?? t.contributorId} · {t.catLabel}{" "}
                        · {t.res.toUpperCase()} · {t.templateApp.toUpperCase()}
                        {t.fileName ? ` · ${t.fileName}` : ""}
                      </div>
                      {t.description && (
                        <p className="text-sm text-zinc-400 mt-2">{t.description}</p>
                      )}
                      {t.reviewNote && (
                        <p className="text-xs text-red-400 mt-1">
                          Izoh: {t.reviewNote}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${STATUS_STYLE[t.reviewStatus]}`}
                      >
                        {STATUS_UZ[t.reviewStatus]}
                        {t.published ? " · live" : ""}
                      </span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {t.reviewStatus === "PENDING_REVIEW" && (
                          <>
                            <button
                              type="button"
                              onClick={() => review(t.id, "approve")}
                              className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"
                            >
                              Tasdiqlash
                            </button>
                            <button
                              type="button"
                              onClick={() => review(t.id, "reject")}
                              className="border border-red-600/50 text-red-400 text-xs px-3 py-1.5 rounded-lg"
                            >
                              Rad etish
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteTemplate(t.id, t.name)}
                          className="text-xs text-zinc-500 hover:text-red-400 px-2"
                        >
                          O‘chirish
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {tab === "settings" && settings && (
          <section className="max-w-xl">
            <p className="text-sm text-zinc-400 mb-4">
              Platforma sozlamalari. To‘liq tahrir:{" "}
              <Link href="/contributor?tab=settings" className="text-[var(--accent)]">
                Contributor markazi
              </Link>
            </p>
            <dl className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">API</dt>
                <dd>{settings.apiBaseUrl || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Tasdiqlash majburiy</dt>
                <dd>{settings.requireApproval ? "Ha" : "Yo‘q"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Default</dt>
                <dd>
                  {settings.defaultRes} · {settings.defaultOrient}
                </dd>
              </div>
            </dl>
          </section>
        )}
      </main>
    </div>
  );
}

export default function AdminContributorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-zinc-400">
          Yuklanmoqda…
        </div>
      }
    >
      <AdminContributorsContent />
    </Suspense>
  );
}