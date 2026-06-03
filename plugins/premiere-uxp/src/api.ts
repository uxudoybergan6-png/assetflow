const API_URL = "http://localhost:4000";

export interface AssetItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: string;
  category: string;
  tags: string[];
  thumbnailUrl: string | null;
  fileSize: number;
}

export interface AssetListResponse {
  items: AssetItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function checkSubscription(token: string) {
  return apiRequest<{ active: boolean; status: string | null }>(
    "/api/plugin/subscription",
    token
  );
}

export async function listAssets(
  token: string,
  params: { search?: string; category?: string; type?: string }
) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  if (params.type) q.set("type", params.type);
  return apiRequest<AssetListResponse>(`/api/assets?${q}`, token);
}

export async function downloadAsset(token: string, assetId: string) {
  return apiRequest<{ downloadUrl: string; fileName?: string }>(
    `/api/assets/${assetId}/download`,
    token,
    { method: "POST", body: JSON.stringify({ source: "premiere-plugin" }) }
  );
}
