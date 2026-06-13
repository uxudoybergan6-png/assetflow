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
      const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl());
      throw new Error(
        isLocal
          ? "API ishlamayapti. Terminalda: npm run dev:api (port 4000)"
          : "Server bilan aloqa uzildi — internetni tekshirib qayta urinib ko'ring"
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

  /**
   * Fayllarni XHR bilan yuklaydi — fetch'dan farqli, upload progress beradi.
   * onProgress(yuklangan, jami) baytlarda chaqiriladi.
   */
  function uploadAssets(id, files, onProgress) {
    const fd = new FormData();
    if (files.thumb) fd.append("thumb", files.thumb);
    if (files.preview) fd.append("preview", files.preview);
    if (files.pack) fd.append("pack", files.pack);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl()}/api/contributor/templates/${id}/assets`);
      const t = token();
      if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`);
      xhr.upload.onprogress = (ev) => {
        if (onProgress && ev.lengthComputable) onProgress(ev.loaded, ev.total);
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
          return;
        }
        // Server JSON xato bersa o'shani, bo'lmasa statusga qarab tushunarli xabar
        const friendly =
          xhr.status === 413
            ? "Fayl juda katta — maksimal 3 GB"
            : xhr.status === 401
              ? "Sessiya tugagan — qayta tizimga kiring"
              : xhr.status === 502 || xhr.status === 503 || xhr.status === 504
                ? "Server javob bermadi — bir ozdan so'ng qayta urinib ko'ring"
                : `Yuklash xatosi (HTTP ${xhr.status})`;
        const err = new Error(
          (data && (data.error || data.message)) || friendly
        );
        err.status = xhr.status;
        err.data = data;
        reject(err);
      };
      xhr.onerror = () =>
        reject(
          new Error("Yuklash uzilib qoldi — internetni tekshirib qayta urinib ko'ring")
        );
      xhr.send(fd);
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

  async function patchContributorStatus(userId, blocked) {
    return request(`/api/contributor/users/${userId}/status`, {
      method: "PATCH",
      body: { blocked },
    });
  }

  async function patchProfile(body) {
    return request("/api/auth/me", { method: "PATCH", body });
  }

  async function pluginAnalytics() {
    return request("/api/admin/plugin-analytics");
  }

  async function listMessageThreads() {
    return request("/api/studio/messages/threads");
  }

  async function getMessageThread(threadId) {
    return request(`/api/studio/messages/threads/${threadId}`);
  }

  async function createMessageThread(payload) {
    return request("/api/studio/messages/threads", {
      method: "POST",
      body: payload,
    });
  }

  async function replyMessageThread(threadId, body) {
    return request(`/api/studio/messages/threads/${threadId}/reply`, {
      method: "POST",
      body: { body },
    });
  }

  async function broadcastMessage(subject, body) {
    return request("/api/studio/messages/broadcast", {
      method: "POST",
      body: { subject, body },
    });
  }

  async function markMessageThreadRead(threadId) {
    return request(`/api/studio/messages/threads/${threadId}/read`, {
      method: "POST",
    });
  }

  async function listAuditLogs(query = "") {
    const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
    return request(`/api/studio/audit${q}`);
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
    patchContributorStatus,
    patchProfile,
    pluginAnalytics,
    listMessageThreads,
    getMessageThread,
    createMessageThread,
    replyMessageThread,
    broadcastMessage,
    markMessageThreadRead,
    listAuditLogs,
    healthCheck,
  };
})();

if (typeof window !== "undefined") window.StudioApi = StudioApi;
