import { prisma } from "@creative-tools/database";

/**
 * Step 20 (P26 Finding 4) — SYBIL / self-dealing aniqlash (FAQAT O'QISH, admin fraud-tahlili).
 *
 * Tahdid: contributor 50 ta email-tasdiqlangan soxta hisob ochadi, har biri uning
 * shablonlarini BIR MARTADAN yuklab oladi → minglab "qonuniy" download → poolning
 * katta qismi unga ketadi (HALOL contributorlardan o'g'irlaydi). Pool rejimida bu
 * bizga to'g'ridan pul yo'qotmaydi, lekin ta'minot tomonini o'ldiradi.
 *
 * BU MODUL PUL MATEMATIKASIGA TEGMAYDI. Earning/pool taqsimoti O'ZGARMAYDI — biz
 * FAQAT SIGNAL beramiz; admin QO'LDA ko'rib chiqadi (MAJBURIY manual review), so'ng
 * payout yozadi. Avtomatik "weight reduction" ataylab QILINMAGAN: u pool taqsimotini
 * (money) o'zgartirar edi — freeze zonasi. O'rniga to'lovdan OLDIN admin ko'radi.
 *
 * Signallar (contributor bo'yicha, uning earning-beruvchi downloaderlari ustida):
 *   1) exclusive  — FAQAT shu contributor shablonlarini yuklab olgan hisoblar ulushi.
 *   2) network    — bir IP-prefiks (subnet /24·/48) ostidagi downloaderlar ulushi.
 *   3) ageCluster — hisob yaratilgan sanasi bir-biriga YAQIN (≤7 kun) hisoblar guruhi.
 *   4) fresh      — hisob ochilgandan ≤24 soat ichida yuklab olingan downloadlar ulushi.
 * Har signal 0..1; vaznli yig'indi = 0..100 xavf ball. Downloaderlar soni past
 * bo'lsa (< MIN_DOWNLOADERS) — ishonch past (score kamaytiriladi).
 */

const DAY_MS = 86_400_000;

/** Payout ushlab turish davri (kun) — bundan yosh earninglar "held" (D3/D5 xavfsizligi). */
export function payoutHoldDays(): number {
  const raw = Number(process.env.PAYOUT_HOLD_DAYS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 30;
}

/** Xavf bali shu chegaradan yuqori → SHUBHALI (majburiy qo'lda ko'rib chiqish). */
export function sybilFlagScore(): number {
  const raw = Number(process.env.SYBIL_FLAG_SCORE);
  if (Number.isFinite(raw) && raw > 0 && raw <= 100) return Math.floor(raw);
  return 50;
}

const MIN_DOWNLOADERS = 3; // bundan kam downloader → statistik ma'nosiz (ishonch past)
const AGE_CLUSTER_WINDOW_MS = 7 * DAY_MS;
const FRESH_MS = DAY_MS;

export type SybilSignals = {
  downloaders: number; // earning-beruvchi distinct downloader (self+admin chiqarilgan)
  events: number;
  withIp: number; // ipPrefix mavjud hodisalar (tahlil qamrovi)
  exclusiveRatio: number;
  topNetworkShare: number; // eng katta IP-prefiks klasteri ulushi
  distinctNetworks: number;
  ageClusterRatio: number; // eng katta yaqin-sana klasteri ulushi
  freshRatio: number;
};

export type SybilContributor = {
  contributorId: string;
  name: string | null;
  email: string | null;
  score: number; // 0..100
  suspicious: boolean;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  signals: SybilSignals;
  sample: Array<{
    userId: string;
    userLabel: string | null;
    ip: string | null;
    ipPrefix: string | null;
    asn: string | null;
    createdAt: Date;
    accountAgeHours: number | null;
    exclusive: boolean;
  }>;
};

/**
 * Barcha contributorlar bo'yicha sybil signallarini hisoblaydi (FAQAT O'QISH).
 * sinceDays oynasidagi kind="download" hodisalar ustida. Downloaderning
 * "distinct contributor" to'plami butun oyna ma'lumotidan hisoblanadi (bir o'tish).
 */
export async function analyzeSybil(
  opts: { sinceDays?: number; onlySuspicious?: boolean } = {}
): Promise<{ generatedAt: Date; sinceDays: number; holdDays: number; flagScore: number; contributors: SybilContributor[] }> {
  const sinceDays = Math.max(1, Math.min(365, opts.sinceDays ?? 90));
  const now = Date.now();
  const since = new Date(now - sinceDays * DAY_MS);

  const events = await prisma.templateDownloadEvent.findMany({
    where: { kind: "download", createdAt: { gte: since } },
    select: {
      contributorId: true,
      userId: true,
      ip: true,
      ipPrefix: true,
      asn: true,
      createdAt: true,
    },
  });

  // Downloader userlarining metadatasi (yosh + rol) — self/admin filtrlash uchun.
  const userIds = [...new Set(events.map((e) => e.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      })
    : [];
  const umap = new Map(users.map((u) => [u.id, u]));

  // Har downloader qaysi contributorlardan yuklab olgan (butun oyna bo'ylab).
  const userContribs = new Map<string, Set<string>>();
  for (const e of events) {
    let s = userContribs.get(e.userId);
    if (!s) userContribs.set(e.userId, (s = new Set()));
    s.add(e.contributorId);
  }

  // Contributor bo'yicha guruhlash.
  const byC = new Map<string, typeof events>();
  for (const e of events) {
    let arr = byC.get(e.contributorId);
    if (!arr) byC.set(e.contributorId, (arr = []));
    arr.push(e);
  }

  const flagScore = sybilFlagScore();
  const out: SybilContributor[] = [];

  for (const [contributorId, evs] of byC) {
    // Earning-beruvchi downloaderlar: self va admin CHIQARILADI (earning gate bilan mos).
    const legit = evs.filter((e) => {
      if (e.userId === contributorId) return false;
      const u = umap.get(e.userId);
      return u?.role !== "ADMIN";
    });
    const downloaderIds = [...new Set(legit.map((e) => e.userId))];
    const n = downloaderIds.length;
    if (n === 0) continue;

    // 1) exclusive — faqat shu contributordan yuklab olgan downloaderlar.
    let exclusive = 0;
    for (const uid of downloaderIds) {
      const set = userContribs.get(uid);
      if (set && set.size === 1) exclusive++;
    }
    const exclusiveRatio = exclusive / n;

    // 2) network — IP-prefiks klasterlari (per-downloader eng ko'p ishlatgan prefiks).
    const prefixToUsers = new Map<string, Set<string>>();
    let withIp = 0;
    for (const e of legit) {
      if (!e.ipPrefix) continue;
      withIp++;
      let s = prefixToUsers.get(e.ipPrefix);
      if (!s) prefixToUsers.set(e.ipPrefix, (s = new Set()));
      s.add(e.userId);
    }
    let topNetwork = 0;
    for (const s of prefixToUsers.values()) topNetwork = Math.max(topNetwork, s.size);
    // downloaderlarning necha qismi bir prefiksda (eng katta klaster).
    const topNetworkShare = n > 0 ? topNetwork / n : 0;
    const distinctNetworks = prefixToUsers.size;

    // 3) ageCluster — downloader hisoblari yaratilgan sana yaqinligi (≤7 kun oyna).
    const ages = downloaderIds
      .map((uid) => umap.get(uid)?.createdAt?.getTime())
      .filter((t): t is number => typeof t === "number")
      .sort((a, b) => a - b);
    let ageCluster = 0;
    for (let i = 0; i < ages.length; i++) {
      let j = i;
      while (j < ages.length && ages[j] - ages[i] <= AGE_CLUSTER_WINDOW_MS) j++;
      ageCluster = Math.max(ageCluster, j - i);
    }
    const ageClusterRatio = ages.length > 0 ? ageCluster / n : 0;

    // 4) fresh — hisob ochilgandan ≤24 soat ichida yuklab olgan downloaderlar.
    const freshUsers = new Set<string>();
    for (const e of legit) {
      const u = umap.get(e.userId);
      if (u?.createdAt && e.createdAt.getTime() - u.createdAt.getTime() <= FRESH_MS) {
        freshUsers.add(e.userId);
      }
    }
    const freshRatio = n > 0 ? freshUsers.size / n : 0;

    // ── Xavf bali (0..100) — vaznli, chegaralar bilan reason ──
    const reasons: string[] = [];
    let score = 0;
    if (n >= MIN_DOWNLOADERS && exclusiveRatio >= 0.7) {
      score += 35;
      reasons.push(`${exclusive}/${n} downloaders downloaded ONLY this contributor's templates`);
    }
    if (n >= MIN_DOWNLOADERS && withIp > 0 && topNetworkShare >= 0.5) {
      score += 30;
      reasons.push(`${topNetwork}/${n} downloaders share one network (IP subnet)`);
    }
    if (n >= MIN_DOWNLOADERS && ageClusterRatio >= 0.7) {
      score += 25;
      reasons.push(`${ageCluster} downloader accounts created within 7 days of each other`);
    }
    if (n >= MIN_DOWNLOADERS && freshRatio >= 0.5) {
      score += 20;
      reasons.push(`${freshUsers.size}/${n} downloads within 24h of account creation`);
    }
    score = Math.min(100, score);

    // Ishonch: downloader kam yoki IP yo'q → past ishonch (score'ni so'ndiramiz).
    let confidence: "low" | "medium" | "high" = "high";
    if (n < MIN_DOWNLOADERS) {
      confidence = "low";
      score = Math.round(score * 0.4);
    } else if (withIp === 0) {
      confidence = "medium"; // tarmoq signali baholanmadi (eski/headersiz yozuvlar)
    }

    const suspicious = score >= flagScore;
    if (opts.onlySuspicious && !suspicious) continue;

    const u0 = umap.get(contributorId);
    const sample = legit
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12)
      .map((e) => {
        const u = umap.get(e.userId);
        const ageH =
          u?.createdAt != null
            ? Math.round(((e.createdAt.getTime() - u.createdAt.getTime()) / 3_600_000) * 10) / 10
            : null;
        return {
          userId: e.userId,
          userLabel: u?.name || u?.email || null,
          ip: e.ip ?? null,
          ipPrefix: e.ipPrefix ?? null,
          asn: e.asn ?? null,
          createdAt: e.createdAt,
          accountAgeHours: ageH,
          exclusive: (userContribs.get(e.userId)?.size ?? 0) === 1,
        };
      });

    out.push({
      contributorId,
      name: u0?.name ?? null,
      email: u0?.email ?? null,
      score,
      suspicious,
      confidence,
      reasons,
      signals: {
        downloaders: n,
        events: legit.length,
        withIp,
        exclusiveRatio: Math.round(exclusiveRatio * 100) / 100,
        topNetworkShare: Math.round(topNetworkShare * 100) / 100,
        distinctNetworks,
        ageClusterRatio: Math.round(ageClusterRatio * 100) / 100,
        freshRatio: Math.round(freshRatio * 100) / 100,
      },
      sample,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return {
    generatedAt: new Date(),
    sinceDays,
    holdDays: payoutHoldDays(),
    flagScore,
    contributors: out,
  };
}
