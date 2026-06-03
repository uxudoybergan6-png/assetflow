"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface Asset {
  id: string;
  title: string;
  slug: string;
  type: string;
  category: string;
  published: boolean;
  downloadCount: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscription: { status: string } | null;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { apiToken?: string })?.apiToken;
  const role = (session?.user as { role?: string })?.role;
  const [tab, setTab] = useState<"assets" | "users">("assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    type: "TRANSITION",
    category: "Transitions",
    fileKey: "",
    fileSize: 1000000,
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role !== "ADMIN") router.push("/dashboard");
  }, [status, role, router]);

  useEffect(() => {
    if (!token || role !== "ADMIN") return;
    loadData();
  }, [token, role, tab]);

  async function loadData() {
    if (tab === "assets") {
      const res = await apiFetch<{ items: Asset[] }>("/api/admin/assets", {
        token,
      });
      setAssets(res.items);
    } else {
      const res = await apiFetch<{ items: User[] }>("/api/admin/users", {
        token,
      });
      setUsers(res.items);
    }
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await apiFetch("/api/admin/assets", {
      method: "POST",
      token,
      body: JSON.stringify({ ...form, tags: [], published: true }),
    });
    setForm({
      title: "",
      slug: "",
      type: "TRANSITION",
      category: "Transitions",
      fileKey: "",
      fileSize: 1000000,
    });
    loadData();
  }

  async function togglePublish(id: string, published: boolean) {
    if (!token) return;
    await apiFetch(`/api/admin/assets/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ published: !published }),
    });
    loadData();
  }

  async function deleteAsset(id: string) {
    if (!token || !confirm("Delete asset?")) return;
    await apiFetch(`/api/admin/assets/${id}`, { method: "DELETE", token });
    loadData();
  }

  async function setUserRole(userId: string, newRole: string) {
    if (!token) return;
    await apiFetch(`/api/contributor/users/${userId}/role`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role: newRole }),
    });
    loadData();
  }

  if (role !== "ADMIN") {
    return <div className="p-20 text-center text-zinc-400">Admin access required</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <div className="flex flex-wrap gap-4 mb-8">
        <a
          href="/admin/contributors"
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-black px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          Contributor boshqaruv paneli →
        </a>
        <a
          href="/contributor?tab=moderation"
          className="inline-flex items-center text-sm text-zinc-400 hover:text-[var(--accent)]"
        >
          Tasdiqlash markazi (qisqa)
        </a>
      </div>

      <div className="flex gap-4 mb-8">
        {(["assets", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg capitalize ${
              tab === t
                ? "bg-[var(--accent)]"
                : "bg-[var(--card)] border border-[var(--border)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "assets" && (
        <>
          <form
            onSubmit={createAsset}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-8 grid md:grid-cols-2 gap-4"
          >
            <h2 className="md:col-span-2 font-semibold">Add Asset</h2>
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-black/30 border border-[var(--border)] rounded px-3 py-2"
              required
            />
            <input
              placeholder="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="bg-black/30 border border-[var(--border)] rounded px-3 py-2"
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="bg-black/30 border border-[var(--border)] rounded px-3 py-2"
            >
              {[
                "MOTION_TEMPLATE",
                "TRANSITION",
                "VFX_OVERLAY",
                "TEXTURE",
                "LUT",
                "PRESET",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="bg-black/30 border border-[var(--border)] rounded px-3 py-2"
            />
            <input
              placeholder="S3 file key"
              value={form.fileKey}
              onChange={(e) => setForm({ ...form, fileKey: e.target.value })}
              className="md:col-span-2 bg-black/30 border border-[var(--border)] rounded px-3 py-2"
              required
            />
            <button
              type="submit"
              className="md:col-span-2 bg-[var(--accent)] py-2 rounded-lg"
            >
              Create Asset
            </button>
          </form>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-[var(--border)]">
                <th className="py-2">Title</th>
                <th>Type</th>
                <th>Downloads</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)]">
                  <td className="py-3">{a.title}</td>
                  <td>{a.type}</td>
                  <td>{a.downloadCount}</td>
                  <td>{a.published ? "Published" : "Draft"}</td>
                  <td className="space-x-2">
                    <button
                      onClick={() => togglePublish(a.id, a.published)}
                      className="text-[var(--accent)]"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={() => deleteAsset(a.id)}
                      className="text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "users" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-[var(--border)]">
              <th className="py-2">Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Subscription</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)]">
                <td className="py-3">{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => setUserRole(u.id, e.target.value)}
                    className="bg-black/30 border border-[var(--border)] rounded px-2 py-1 text-xs"
                  >
                    <option value="USER">USER</option>
                    <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>{u.subscription?.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
