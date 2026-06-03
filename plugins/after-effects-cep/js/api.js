const API_URL = "http://localhost:4000";

async function apiRequest(path, token, options = {}) {
  const res = await fetch(API_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(function () { return {}; });
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function checkSubscription(token) {
  return apiRequest("/api/plugin/subscription", token);
}

function listAssets(token, params) {
  var q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  return apiRequest("/api/assets?" + q, token);
}

function downloadAsset(token, assetId) {
  return apiRequest("/api/assets/" + assetId + "/download", token, {
    method: "POST",
    body: JSON.stringify({ source: "after-effects-plugin" }),
  });
}
