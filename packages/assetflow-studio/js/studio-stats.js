/**
 * Statistics computed from templates and the API (no demo numbers)
 */
function buildRejectReasonsFromTemplates() {
  const buckets = {};
  TEMPLATES.filter((t) => t.status === "soft" || t.status === "hard").forEach((t) => {
    const raw = (t.reason || "").trim();
    const nm = raw ? raw.slice(0, 72) : "No reason given";
    if (!buckets[nm]) buckets[nm] = { nm, soft: 0, hard: 0 };
    if (t.status === "soft") buckets[nm].soft++;
    else buckets[nm].hard++;
  });
  return Object.values(buckets)
    .sort((a, b) => b.soft + b.hard - (a.soft + a.hard))
    .slice(0, 10);
}

function syncRejectReasons() {
  if (typeof REJECT_REASONS === "undefined") return;
  REJECT_REASONS.splice(0, REJECT_REASONS.length, ...buildRejectReasonsFromTemplates());
}

function platformApprovalRatePct() {
  const reviewed = TEMPLATES.filter((t) =>
    ["approved", "soft", "hard"].includes(t.status)
  );
  if (!reviewed.length) return null;
  const ap = reviewed.filter((t) => t.status === "approved").length;
  return Math.round((ap / reviewed.length) * 100);
}

function avgDownloadsPerApproved() {
  const ap = counts().approved;
  if (!ap) return 0;
  return Math.round(counts().totalDl / ap);
}

function applyActivityByDay(series) {
  if (!Array.isArray(series) || typeof DL_30 === "undefined") return;
  const n = Math.min(series.length, DL_30.length);
  for (let i = 0; i < DL_30.length; i++) DL_30[i] = 0;
  for (let i = 0; i < n; i++) DL_30[DL_30.length - n + i] = series[i] || 0;
  if (typeof DL_7 !== "undefined") {
    for (let i = 0; i < DL_7.length; i++) DL_7[i] = 0;
    const tail = DL_30.slice(-7);
    for (let i = 0; i < tail.length; i++) DL_7[i] = tail[i];
  }
}

function chartMax(arr) {
  const m = Math.max(...arr, 0);
  return m > 0 ? m : 1;
}
