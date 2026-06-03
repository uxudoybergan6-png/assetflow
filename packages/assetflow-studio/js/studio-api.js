/**
 * AssetFlow Studio — REST API (creative-tools API :4000)
 */
const StudioApi = (() => {
  function baseUrl() {
    return (
      (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
  }

  function token() {
    const s = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
    return s?.apiToken || "";
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    let res;
    try {
      res = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });
    } catch (e) {
      throw new Error(
        "API ishlamayapti. Terminalda: npm run dev:api (port 4000)"
      );
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function healthCheck() {
    try {
      const res = await fetch(`${baseUrl()}/health`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function login(email, password) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return data;
  }

  async function register({ email, password, name }) {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: {
        email,
        password,
        name,
        asContributor: true,
      },
    });
    return data;
  }

  async function createTemplate(payload) {
    return request("/api/contributor/templates", {
      method: "POST",
      body: payload,
    });
  }

  async function submitTemplate(id) {
    return request(`/api/contributor/templates/${id}/submit`, { method: "POST" });
  }

  async function uploadAssets(id, files) {
    const fd = new FormData();
    if (files.thumb) fd.append("thumb", files.thumb);
    if (files.preview) fd.append("preview", files.preview);
    if (files.pack) fd.append("pack", files.pack);
    return request(`/api/contributor/templates/${id}/assets`, {
      method: "POST",
      body: fd,
    });
  }

  async function listTemplates(query = "") {
    const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
    return request(`/api/contributor/templates${q}`);
  }

  async function reviewTemplate(id, action, note) {
    return request(`/api/contributor/templates/${id}/review`, {
      method: "POST",
      body: {
        action,
        note: note || undefined,
        published: action === "approve",
      },
    });
  }

  async function patchTemplate(id, body) {
    return request(`/api/contributor/templates/${id}`, {
      method: "PATCH",
      body,
    });
  }

  async function deleteTemplate(id) {
    return request(`/api/contributor/templates/${id}`, { method: "DELETE" });
  }

  async function adminOverview() {
    return request("/api/contributor/admin/overview");
  }

  async function listPluginSubscribers() {
    return request("/api/admin/plugin-subscribers");
  }

  async function patchPluginSubscriber(userId, body) {
    return request(`/api/admin/plugin-subscribers/${userId}`, {
      method: "PATCH",
      body,
    });
  }

  return {
    baseUrl,
    token,
    request,
    login,
    register,
    createTemplate,
    submitTemplate,
    uploadAssets,
    listTemplates,
    reviewTemplate,
    patchTemplate,
    deleteTemplate,
    adminOverview,
    listPluginSubscribers,
    patchPluginSubscriber,
    healthCheck,
  };
})();

if (typeof window !== "undefined") window.StudioApi = StudioApi;
