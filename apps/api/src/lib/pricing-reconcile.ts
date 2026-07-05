/**
 * NARX-DRIFT MONITORING (Bosqich 3.5) — oylik reconciliation + marja alerti.
 *
 * Har oy daromad (kredit×creditUsdValue) vs REAL provider narx (ProviderSpend.estimatedCostUsd)
 * agregatlanadi, amaldagi marja hisoblanadi. Marja maqsaddan (default 1.8x) past bo'lsa mavjud
 * bildirishnoma yo'li (email; PRICING_ALERT_WEBHOOK_URL bo'lsa webhook ham) orqali ALERT chiqadi.
 *
 * "Provider narxi oshdimi?" — REAL invoice (ProviderInvoice, admin kiritadi) tizim TAXMINI bilan
 * solishtiriladi: real xarajat estimate'dan oshsa drift ko'rinadi → marja tushadi → alert.
 *
 * PUL ZONASIGA TEGMAYDI — read-only agregatsiya + bildirishnoma. Kredit mutatsiyasi yo'q.
 * Ham cron-uslub funksiya (runMonthlyReconciliation), ham admin trigger endpoint bilan ishlaydi.
 */
import { prisma } from "@creative-tools/database";
import { getPricingConfig } from "./model-pricing.js";
import { computeMargins, spendByProvider } from "./model-margin.js";
import { sendEmail, renderEmailLayout, isEmailConfigured } from "./email.js";

function round(n: number, d = 4): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

/** "YYYY-MM" → oy oralig'i (UTC). Berilmasa — joriy oy. until = oyning oxirgi ms. */
export function monthRange(month?: string): { month: string; since: Date; until: Date } {
  let y: number;
  let m: number; // 1..12
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    y = Number(month.slice(0, 4));
    m = Number(month.slice(5, 7));
  } else {
    const now = new Date();
    y = now.getUTCFullYear();
    m = now.getUTCMonth() + 1;
  }
  const since = new Date(Date.UTC(y, m - 1, 1));
  const until = new Date(Date.UTC(y, m, 1) - 1); // keyingi oy boshidan 1ms oldin
  const label = `${y}-${String(m).padStart(2, "0")}`;
  return { month: label, since, until };
}

export type ReconProvider = {
  provider: string;
  gens: number;
  credits: number;
  estimatedUsd: number; // tizim taxmini (ProviderSpend)
  actualUsd: number | null; // admin kiritgan real invoice
  driftUsd: number | null; // actual - estimated
  driftPct: number | null; // drift / estimated × 100
};

export type ReconReport = {
  month: string;
  since: string;
  until: string;
  creditUsdValue: number;
  marginTarget: number;
  revenueUsd: number;
  estimatedCostUsd: number;
  realizedMargin: number | null; // daromad / estimate
  actualCostUsd: number | null; // Σ invoice (bor bo'lsa)
  actualMargin: number | null; // daromad / actual
  belowTarget: boolean; // amaldagi marja (actual ustun, aks holda estimate) maqsaddan past
  providers: ReconProvider[];
  flaggedModels: number;
  alert: { belowTarget: boolean; sent: boolean; channels: string[]; recipient: string | null };
};

/** Alert qabul qiluvchi: ALERT_EMAIL env, aks holda birinchi ADMIN foydalanuvchi emaili. */
async function alertRecipient(): Promise<string | null> {
  const env = process.env.ALERT_EMAIL?.trim() || process.env.ADMIN_ALERT_EMAIL?.trim();
  if (env) return env;
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    return admin?.email ?? null;
  } catch {
    return null;
  }
}

/** Webhook (Slack/generic) — env bo'lsa JSON POST (best-effort). */
async function postWebhook(text: string, report: ReconReport): Promise<boolean> {
  const url = process.env.PRICING_ALERT_WEBHOOK_URL?.trim() || process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, report }),
    });
    return res.ok;
  } catch (e) {
    console.error("[reconcile] webhook xato:", e);
    return false;
  }
}

async function sendMarginAlert(report: ReconReport): Promise<{ sent: boolean; channels: string[]; recipient: string | null }> {
  const channels: string[] = [];
  const margin = report.actualMargin ?? report.realizedMargin;
  const marginStr = margin == null ? "noma'lum (real narx yo'q)" : `${margin}x`;
  const subject = `⚠️ FrameFlow marja alerti — ${report.month}: ${marginStr} (maqsad ${report.marginTarget}x)`;
  const lines = [
    `Oy: <b>${report.month}</b>`,
    `Daromad: <b>$${report.revenueUsd}</b> (${report.creditUsdValue}$/kredit)`,
    `Taxminiy provider narx: <b>$${report.estimatedCostUsd}</b>`,
    report.actualCostUsd != null ? `Real invoice narx: <b>$${report.actualCostUsd}</b>` : "",
    `Amaldagi marja: <b>${marginStr}</b> · maqsad: ${report.marginTarget}x`,
    `Bayroqlangan model: ${report.flaggedModels}`,
  ].filter(Boolean);
  const providerRows = report.providers
    .map(
      (p) =>
        `<tr><td>${p.provider}</td><td>$${p.estimatedUsd}</td><td>${p.actualUsd == null ? "—" : "$" + p.actualUsd}</td><td>${p.driftUsd == null ? "—" : "$" + p.driftUsd + (p.driftPct != null ? ` (${p.driftPct}%)` : "")}</td></tr>`
    )
    .join("");
  const html = renderEmailLayout(
    "Marja maqsaddan past",
    `<p>${lines.join("<br>")}</p>
     <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px">
       <tr style="color:#888"><th align="left">Provider</th><th align="left">Taxmin</th><th align="left">Real</th><th align="left">Drift</th></tr>
       ${providerRows}
     </table>`
  );
  const text = `${subject}\nDaromad $${report.revenueUsd} / taxmin $${report.estimatedCostUsd}${report.actualCostUsd != null ? ` / real $${report.actualCostUsd}` : ""} — marja ${marginStr} (maqsad ${report.marginTarget}x)`;

  const recipient = await alertRecipient();
  if (recipient && isEmailConfigured()) {
    const ok = await sendEmail({ to: recipient, subject, html, text });
    if (ok) channels.push("email");
  }
  const hooked = await postWebhook(text, report);
  if (hooked) channels.push("webhook");
  if (!channels.length) {
    console.warn(`[reconcile] ALERT (yuborilmadi — kanal yo'q): ${text}`);
  }
  return { sent: channels.length > 0, channels, recipient };
}

/**
 * Oylik reconciliation — cron-uslub funksiya VA admin endpoint shuni chaqiradi.
 * `opts.sendAlert=false` → hisob-kitob qiladi, lekin alert yubormaydi (quruq ko'rish/test).
 */
export async function runMonthlyReconciliation(opts?: {
  month?: string;
  sendAlert?: boolean;
}): Promise<ReconReport> {
  const { month, since, until } = monthRange(opts?.month);
  const { creditUsdValue, marginTarget } = await getPricingConfig();

  const [margins, providerSpend, invoices] = await Promise.all([
    computeMargins({ since, until }),
    spendByProvider({ since, until }),
    prisma.providerInvoice.findMany({ where: { periodMonth: month } }),
  ]);

  const invoiceByProvider = new Map(invoices.map((i) => [i.provider, Number(i.actualUsd)]));
  const providers: ReconProvider[] = providerSpend.map((p) => {
    const actualUsd = invoiceByProvider.has(p.provider) ? (invoiceByProvider.get(p.provider) as number) : null;
    const driftUsd = actualUsd == null ? null : round(actualUsd - p.estimatedUsd);
    const driftPct = actualUsd == null || p.estimatedUsd <= 0 ? null : round((driftUsd! / p.estimatedUsd) * 100, 2);
    return { provider: p.provider, gens: p.gens, credits: p.credits, estimatedUsd: p.estimatedUsd, actualUsd, driftUsd, driftPct };
  });

  const revenueUsd = margins.aggregate.revenueUsd;
  const estimatedCostUsd = margins.aggregate.realCostUsd;
  const realizedMargin = margins.aggregate.margin;
  // Real invoice bor providerlar bo'yicha jami (bo'lmaganlar hisobga kirmaydi → null).
  const actualCostUsd = invoices.length ? round(invoices.reduce((s, i) => s + Number(i.actualUsd), 0)) : null;
  const actualMargin = actualCostUsd && actualCostUsd > 0 ? round(revenueUsd / actualCostUsd, 3) : null;
  // Amaldagi marja: real invoice bor bo'lsa ustun (haqiqatga yaqin), aks holda estimate.
  const effectiveMargin = actualMargin ?? realizedMargin;
  const belowTarget = effectiveMargin != null && effectiveMargin < marginTarget;

  const report: ReconReport = {
    month,
    since: since.toISOString(),
    until: until.toISOString(),
    creditUsdValue,
    marginTarget,
    revenueUsd,
    estimatedCostUsd,
    realizedMargin,
    actualCostUsd,
    actualMargin,
    belowTarget,
    providers,
    flaggedModels: margins.flagged.length,
    alert: { belowTarget, sent: false, channels: [], recipient: null },
  };

  if (belowTarget && opts?.sendAlert !== false) {
    const r = await sendMarginAlert(report);
    report.alert = { belowTarget, ...r };
  }
  return report;
}

/** Real oylik provider invoice yozadi/yangilaydi (provider+oy bo'yicha upsert). */
export async function recordProviderInvoice(input: {
  provider: string;
  periodMonth: string;
  actualUsd: number;
  note?: string | null;
  createdById?: string | null;
}): Promise<void> {
  await prisma.providerInvoice.upsert({
    where: { provider_periodMonth: { provider: input.provider, periodMonth: input.periodMonth } },
    create: {
      provider: input.provider,
      periodMonth: input.periodMonth,
      actualUsd: input.actualUsd,
      note: input.note ?? null,
      createdById: input.createdById ?? null,
    },
    update: { actualUsd: input.actualUsd, note: input.note ?? null, createdById: input.createdById ?? null },
  });
}

export async function listProviderInvoices(month?: string) {
  return prisma.providerInvoice.findMany({
    where: month ? { periodMonth: month } : {},
    orderBy: [{ periodMonth: "desc" }, { provider: "asc" }],
  });
}

/**
 * Cron-uslub scheduler — env PRICING_RECON_SCHEDULE=on bo'lsa yoqiladi (default OFF; ko'p-instansda
 * dublikat alertni oldini olish uchun). Har 24 soatda tekshiradi; UTC oyning 1-kunida O'TGAN oy
 * uchun reconciliation qiladi. Tashqi cron (Cloud Scheduler) bo'lsa — GET /api/admin/pricing/reconcile
 * yoki bu funksiyani to'g'ridan chaqirish afzal.
 */
export function startReconciliationScheduler(): void {
  if (process.env.PRICING_RECON_SCHEDULE !== "on") return;
  const DAY = 86_400_000;
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCDate() !== 1) return;
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
      const r = await runMonthlyReconciliation({ month });
      console.log(`[reconcile] ${month}: marja ${r.actualMargin ?? r.realizedMargin ?? "n/a"}x, alert=${r.alert.sent}`);
    } catch (e) {
      console.error("[reconcile] scheduler xato:", e);
    }
  };
  setInterval(tick, DAY);
  console.log("[reconcile] oylik scheduler yoqildi (PRICING_RECON_SCHEDULE=on)");
}
