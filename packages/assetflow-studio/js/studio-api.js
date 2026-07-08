/**
 * AssetFlow Studio — REST API (creative-tools API :4000)
 */
const StudioApi = (() => {
  function baseUrl() {
    return (
      (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) ||
      "https://api.getframeflow.app"
    ).replace(/\/$/, "");
  }

  function token() {
    const s = typeof AssetFlowAuth !== "undefined" ? AssetFlowAuth.getSession() : null;
    return s?.apiToken || "";
  }

  // Global 401 ishlovi: token yuborilgan bo'lsa-yu server 401 qaytarsa —
  // sessiya tugagan/bekor qilingan. Sessiyani tozalab login'ga qaytaramiz.
  let _handling401 = false;
  function handleExpiredSession() {
    if (_handling401) return;
    _handling401 = true;
    try {
      if (typeof AssetFlowAuth !== "undefined") AssetFlowAuth.clearSession();
      localStorage.removeItem("af_remember_email");
      localStorage.removeItem("af_remember_session");
    } catch {}
    // Login sahifalarida redirect qilmaymiz (loop oldini olish)
    const path = (typeof location !== "undefined" && location.pathname) || "";
    if (/login\.html$/.test(path)) return;
    const loginUrl =
      (typeof AssetFlowAuth !== "undefined" &&
        AssetFlowAuth.getSession === undefined) // sun'iy emas; aniq URL'ni window konfigdan olamiz
        ? null
        : null;
    const target =
      (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.loginUrl) ||
      "/studio/login.html";
    try {
      sessionStorage.setItem("af_session_expired", "1");
    } catch {}
    location.href = target;
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const fetchOpts = {
      ...options,
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
    };
    // Tarmoq xatosida qayta urinish — Render free-tarif "cold start" (uyqudan uyg'onish)
    // birinchi so'rovni uzishi mumkin. 3 urinish (1.5s, 3s backoff). Network-throw = server
    // so'rovni qayta ishlamadi → POST takrori xavfsiz.
    let res, lastErr;
    for (let a = 0; a < 3; a++) {
      try {
        res = await fetch(`${baseUrl()}${path}`, fetchOpts);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (a < 2) await new Promise((r) => setTimeout(r, 1500 * (a + 1)));
      }
    }
    if (lastErr) {
      const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl());
      throw new Error(
        isLocal
          ? "API is not running. In the terminal: npm run dev:api (port 4000)"
          : "Lost connection to the server — it may be waking up from sleep, please wait and try again"
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
      // Global 401: token yuborilgan bo'lsa — sessiya tugagan, login'ga qaytaramiz.
      if (res.status === 401 && t) {
        handleExpiredSession();
      }
      const err = new Error(
        res.status === 401
          ? data?.error || data?.message || "Session expired — please sign in again"
          : data?.error || data?.message || `HTTP ${res.status}`
      );
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

  async function register({ email, password, name, turnstileToken }) {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: {
        email,
        password,
        name,
        asContributor: true,
        turnstileToken,
      },
    });
    return data;
  }

  async function googleLogin(credential) {
    return request("/api/auth/google", {
      method: "POST",
      body: { credential },
    });
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
  // Bitta XHR yuklash (PUT R2 yoki POST server). opts: {method,url,body,headers,onProg}.
  // 502/503/504/tarmoq uzilishida {__retry:true} bilan rad etadi (tashqi run() qayta uradi).
  function xhrSend(opts, tryNo) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method, opts.url);
      const h = opts.headers || {};
      Object.keys(h).forEach((k) => xhr.setRequestHeader(k, h[k]));
      xhr.upload.onprogress = (ev) => {
        if (opts.onProg && ev.lengthComputable) opts.onProg(ev.loaded);
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
        if ((xhr.status === 502 || xhr.status === 503 || xhr.status === 504) && tryNo < 2) {
          reject({ __retry: true });
          return;
        }
        const friendly =
          xhr.status === 413
            ? "File is too large — maximum 3 GB"
            : xhr.status === 401
              ? "Session expired — please sign in again"
              : `Upload error (HTTP ${xhr.status})`;
        const err = new Error((data && (data.error || data.message)) || friendly);
        err.status = xhr.status;
        reject(err);
      };
      xhr.onerror = () => {
        if (tryNo < 2) reject({ __retry: true });
        else reject(new Error("Upload interrupted — check your internet connection and try again"));
      };
      xhr.send(opts.body);
    });
  }
  function xhrWithRetry(opts) {
    const run = async (tryNo) => {
      try {
        return await xhrSend(opts, tryNo);
      } catch (e) {
        if (e && e.__retry && tryNo < 2) {
          await new Promise((r) => setTimeout(r, 5000 * (tryNo + 1)));
          return run(tryNo + 1);
        }
        throw e;
      }
    };
    return run(0);
  }

  /**
   * Fayllarni yuklaydi. thumb+preview+pack — HAMMASI TO'G'RIDAN bulutga (presigned PUT,
   * server chetda — OOM/413 yo'q). Pack ilgari multer /assets orqali server tanasidan
   * oqardi; Cloud Run 32MB so'rov limiti katta AE pack'larni (100MB–GB) rad etardi.
   * Endi pack ham presigned PUT, so'ng /pack-uploaded signali (server .zip'dan .mogrt
   * sahnalarni FON'da ajratadi). onProgress(jamiYuklangan) baytlarda (thumb→preview→pack
   * tartibida kumulyativ — orderedUploadFiles bilan mos).
   */
  async function uploadAssets(id, files, onProgress) {
    const order = ["thumb", "preview", "pack"].filter((k) => files[k]);
    let urls = [];
    if (order.length) {
      const resp = await request(`/api/contributor/templates/${id}/upload-url`, {
        method: "POST",
        body: {
          files: order.map((k) => ({
            kind: k,
            fileName: files[k].name,
            contentType: files[k].type || "application/octet-stream",
          })),
        },
      });
      urls = (resp && resp.uploads) || [];
    }
    let base = 0; // tugagan fayllar yig'indisi (kumulyativ progress uchun)
    for (const k of order) {
      const onProg = (loaded) => {
        if (onProgress) onProgress(base + loaded);
      };
      const u = urls.find((x) => x.kind === k);
      if (!u) throw new Error(`Failed to get upload URL for ${k}`);
      // Bulut presigned PUT — FAQAT Content-Type (Authorization YO'Q, imzo buzilmasin)
      await xhrWithRetry({
        method: "PUT",
        url: u.url,
        body: files[k],
        headers: { "Content-Type": u.contentType },
        onProg,
      });
      base += files[k].size;
      if (onProgress) onProgress(base);
    }
    // #15: preview presigned PUT tugadi → server-side fon transcode signali
    // (POST /preview-uploaded → status='pending' + fon 720p siqish). Xatoga
    // chidamli: signal fail bo'lsa ham asosiy upload MUVAFFAQIYATLI hisoblanadi
    // (transcode fon ishi; preview xom holicha baribir ko'rinadi).
    if (files.preview) {
      try {
        await request(`/api/contributor/templates/${id}/preview-uploaded`, { method: "POST" });
      } catch (e) {
        console.warn("preview-uploaded signal not sent (transcode will retry later):", e);
      }
    }
    // Pack presigned PUT tugadi → server signali: DB'ga nom/hajm yozadi va .zip
    // bo'lsa .mogrt sahnalarni FON'da ajratadi. Bu signal MAJBURIY (multer yo'li
    // olib tashlangani uchun DB fileName/fileSize faqat shu yerda yoziladi).
    if (files.pack) {
      await request(`/api/contributor/templates/${id}/pack-uploaded`, {
        method: "POST",
        body: { fileName: files.pack.name },
      });
    }
    // FAZA 5 (A2): thumb faqat presigned PUT bilan ketganda serverda hech qanday
    // signal yo'q edi — asset kalitlari keshi (assetKeysJson) eskirib qolardi.
    // preview/pack o'z signalida sinxronlaydi; thumb-only holat uchun yengil signal.
    if (files.thumb && !files.preview && !files.pack) {
      try {
        await request(`/api/contributor/templates/${id}/assets-uploaded`, { method: "POST" });
      } catch (e) {
        console.warn("assets-uploaded signal not sent:", e);
      }
    }
    return { ok: true };
  }

  /**
   * FAZA 2 — cloud ingest bulk uploader: har `.zip` (bitta shablon = .aep/.mogrt +
   * preview rasm + preview video) `incoming/`ga to'g'ridan (presigned PUT) yuklanadi,
   * so'ng `/ingest` chaqirilib har biri "pending" shablonga aylantiriladi.
   * onFileProgress(index, {stage,pct,error,id}) har fayl uchun alohida chaqiriladi —
   * stage: 'uploading'|'processing'|'done'|'error'. Bitta faylning muvaffaqiyatsizligi
   * qolganlarini to'xtatmaydi.
   */
  async function bulkIngestZips(files, onFileProgress, rights) {
    const resp = await request("/api/contributor/incoming/upload-url", {
      method: "POST",
      body: { files: files.map((f) => ({ fileName: f.name })) },
    });
    const uploads = (resp && resp.uploads) || [];
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const u = uploads[i];
      if (!u) {
        if (onFileProgress) onFileProgress(i, { stage: "error", error: "No upload URL returned" });
        continue;
      }
      if (onFileProgress) onFileProgress(i, { stage: "uploading", pct: 0 });
      try {
        await xhrWithRetry({
          method: "PUT",
          url: u.url,
          body: f,
          headers: { "Content-Type": "application/zip" },
          onProg: (loaded) => {
            const pct = f.size > 0 ? Math.floor((loaded / f.size) * 100) : 100;
            if (onFileProgress) onFileProgress(i, { stage: "uploading", pct });
          },
        });
        if (onFileProgress) onFileProgress(i, { stage: "processing", pct: 100 });
        uploaded.push({ index: i, key: u.key });
      } catch (e) {
        if (onFileProgress) onFileProgress(i, { stage: "error", error: e.message || "Upload failed" });
      }
    }
    let results = [];
    if (uploaded.length) {
      const ingestResp = await request("/api/contributor/ingest", {
        method: "POST",
        body: {
          keys: uploaded.map((u) => u.key),
          // FAZA 1b — rights attestation (butun partiyaga bitta majburiy checkbox)
          rightsAccepted: !!(rights && rights.rightsAccepted),
          rightsTermsVersion: (rights && rights.rightsTermsVersion) || undefined,
        },
      });
      results = (ingestResp && ingestResp.results) || [];
      for (const { index, key } of uploaded) {
        const r = results.find((x) => x.key === key);
        if (r && r.ok) {
          if (onFileProgress) onFileProgress(index, { stage: "done", id: r.id });
        } else if (r && r.status === "duplicate") {
          // FAZA 6a: dublikat — xato emas, alohida aniq holat (ikkinchi nusxa yaratilmadi).
          if (onFileProgress) onFileProgress(index, { stage: "duplicate", error: r.reason || "Duplicate", id: r.duplicateOf });
        } else {
          if (onFileProgress) onFileProgress(index, { stage: "error", error: (r && r.reason) || "Processing failed" });
        }
      }
    }
    return results;
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

  // Admin: karantin/pending pack'ni qo'lda TOZALASH — approve blokini ochadi (Bosqich 2 #2).
  // Tasdiqlangan malicious/duplicate'ni tozalamaydi (server 409 qaytaradi).
  async function clearPack(id) {
    return request(`/api/contributor/admin/templates/${id}/pack-clear`, {
      method: "POST",
    });
  }

  // Admin: OMMAVIY moderatsiya — bir necha shablonga birdan approve (+ Free/Pro), reject yoki
  // clear-pack. Server har elementни alohida ishlaydi va per-item natija qaytaradi (bitta yomon
  // element partiyani to'xtatmaydi). action: "approve" | "reject" | "clear-pack".
  async function bulkReview(ids, action, opts = {}) {
    const body = { ids, action };
    if (opts.note != null) body.note = opts.note;
    if (typeof opts.published === "boolean") body.published = opts.published;
    if (typeof opts.isPro === "boolean") body.isPro = opts.isPro;
    return request(`/api/contributor/admin/templates/bulk`, {
      method: "POST",
      body,
    });
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

  async function updateSubscriber(userId, body) {
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

  /** AI semantik qidiruv — tasdiqlangan shablonlarga embedding backfill (ADMIN). */
  async function reindexAi(force = false) {
    return request(`/api/plugin/ai/reindex`, {
      method: "POST",
      body: { force: !!force },
    });
  }

  /* ── BIZNES MARKAZ (admin-only READ + narx write) ── */
  async function getAdminPricing() {
    return request(`/api/admin/pricing`);
  }
  async function patchAdminPricing(modelId, body) {
    return request(`/api/admin/pricing/${encodeURIComponent(modelId)}`, { method: "PATCH", body });
  }
  async function patchAdminPricingConfig(body) {
    return request(`/api/admin/pricing/config`, { method: "PATCH", body });
  }
  async function getAdminFinance(month) {
    return request(`/api/admin/finance${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  }
  async function getAdminGenSpend(month) {
    return request(`/api/admin/gen-spend${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  }
  async function getAdminActivity(type) {
    return request(`/api/admin/activity${type && type !== "all" ? `?type=${encodeURIComponent(type)}` : ""}`);
  }
  async function getAdminEarnings() {
    return request(`/api/contributor/admin/earnings`);
  }
  async function createAdminPayout(body) {
    return request(`/api/contributor/admin/payouts`, { method: "POST", body });
  }
  /* FAZA 4 — real daromad metrikalari + pool payout */
  async function getAdminMetrics(month) {
    return request(`/api/admin/metrics${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  }
  async function getAdminPoolPreview(month) {
    return request(`/api/admin/payout/pool?month=${encodeURIComponent(month)}`);
  }
  async function computeAdminPool(month, recompute) {
    return request(`/api/admin/payout/pool`, { method: "POST", body: { month, recompute: !!recompute } });
  }

  /* FAZA 6b — rollar boshqaruvi + contributor onboarding */
  async function listAdminUsers({ search, role, pending } = {}) {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (role && role !== "all") q.set("role", role);
    if (pending) q.set("pending", "1");
    const qs = q.toString();
    return request(`/api/admin/users${qs ? `?${qs}` : ""}`);
  }
  async function setUserRole(id, role) {
    return request(`/api/admin/users/${id}/role`, { method: "PATCH", body: { role } });
  }
  async function dismissContributorRequest(id) {
    return request(`/api/admin/users/${id}/contributor-request`, { method: "DELETE" });
  }
  async function requestContributorAccess(apiToken) {
    return request(`/api/users/contributor-request`, {
      method: "POST",
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
    });
  }

  return {
    baseUrl,
    token,
    request,
    login,
    register,
    googleLogin,
    createTemplate,
    submitTemplate,
    uploadAssets,
    bulkIngestZips,
    listTemplates,
    reviewTemplate,
    patchTemplate,
    deleteTemplate,
    clearPack,
    bulkReview,
    adminOverview,
    listPluginSubscribers,
    patchPluginSubscriber,
    updateSubscriber,
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
    reindexAi,
    getAdminPricing,
    patchAdminPricing,
    patchAdminPricingConfig,
    getAdminFinance,
    getAdminGenSpend,
    getAdminActivity,
    getAdminEarnings,
    createAdminPayout,
    getAdminMetrics,
    getAdminPoolPreview,
    computeAdminPool,
    listAdminUsers,
    setUserRole,
    dismissContributorRequest,
    requestContributorAccess,
    healthCheck,
  };
})();

if (typeof window !== "undefined") window.StudioApi = StudioApi;
