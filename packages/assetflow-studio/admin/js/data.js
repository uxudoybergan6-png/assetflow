/* ============================================================
   AssetFlow — UI ma'lumotlari (bo'sh boshlang'ich; API dan to'ldiriladi)
   ============================================================ */
const CATS = ['Logo Reveal','Title / Intro','Lower Thirds','Transitions','Social Media','Slideshow','Infographics','Backgrounds','YouTube','Instagram Reels'];
const GRADS = ['g1','g2','g3','g4','g5','g6','g7','g8','g9','g10'];

const CAT_SLUGS = {
  "Logo Reveal": { cat: "logos", catLabel: "Logo Reveal" },
  "Title / Intro": { cat: "intros", catLabel: "Title / Intro" },
  "Lower Thirds": { cat: "lowerthirds", catLabel: "Lower Thirds" },
  Transitions: { cat: "transitions", catLabel: "Transitions" },
  "Social Media": { cat: "social", catLabel: "Social Media" },
  Slideshow: { cat: "slideshows", catLabel: "Slideshow" },
  Infographics: { cat: "infographics", catLabel: "Infographics" },
  Backgrounds: { cat: "backgrounds", catLabel: "Backgrounds" },
  YouTube: { cat: "intros", catLabel: "YouTube" },
  "Instagram Reels": { cat: "social", catLabel: "Instagram Reels" },
};

function catFromLabel(label) {
  return CAT_SLUGS[label] || { cat: "intros", catLabel: label || "Other" };
}

/**
 * AE Browse plugin — faqat Free va Pro
 * downloadLimit: oyiga yuklab olish; unlimitedDownloads=true bo‘lsa limit yo‘q
 */
let PLUGIN_PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Boshlash uchun',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    unlimitedDownloads: false,
    downloadLimit: 15,
    importLimit: 10,
    catalog: 'Barcha tasdiqlangan shablonlar (watermark bilan)',
    maxResolution: '1080p',
    features: [
      '15 ta yuklab olish / oy',
      '10 ta AE import / oy',
      '1080p gacha',
      'Jamiyat katalogi',
    ],
    active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Professional studiya',
    priceMonthly: 19,
    priceYearly: 190,
    currency: 'USD',
    unlimitedDownloads: true,
    downloadLimit: null,
    importLimit: null,
    catalog: 'To‘liq katalog + 4K + yangiliklar birinchi navbatda',
    maxResolution: '4K',
    features: [
      'Cheksiz yuklab olish',
      'Cheksiz AE import',
      '4K va pack fayllar',
      'Yangi shablonlarga erta kirish',
    ],
    active: true,
  },
];

/** Pro tarif uchun chegirma / promo kod (admin boshqaradi) */
let PLUGIN_PROMO = {
  enabled: false,
  code: '',
  label: '',
  type: 'percent',
  value: 0,
  appliesTo: 'both',
  validFrom: '',
  validUntil: '',
  bannerText: '',
  maxUses: null,
  usedCount: 0,
};

function loadPluginPlans() {
  try {
    const raw = localStorage.getItem('af_plugin_plans');
    if (!raw) return PLUGIN_PLANS;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      PLUGIN_PLANS = data;
    } else {
      if (data.plans) PLUGIN_PLANS = data.plans;
      if (data.promo) PLUGIN_PROMO = { ...PLUGIN_PROMO, ...data.promo };
    }
  } catch (e) {
    console.warn('af_plugin_plans', e);
  }
  return PLUGIN_PLANS;
}

function savePluginPlans() {
  localStorage.setItem(
    'af_plugin_plans',
    JSON.stringify({ plans: PLUGIN_PLANS, promo: PLUGIN_PROMO })
  );
}

function promoAppliesTo(period) {
  if (!PLUGIN_PROMO.enabled) return false;
  const a = PLUGIN_PROMO.appliesTo || 'both';
  if (a === 'both') return true;
  return a === period;
}

function applyPromoPrice(base) {
  if (!PLUGIN_PROMO.enabled || base <= 0) return base;
  const v = Number(PLUGIN_PROMO.value) || 0;
  if (PLUGIN_PROMO.type === 'fixed') return Math.max(0, base - v);
  return Math.max(0, Math.round(base * (1 - v / 100) * 100) / 100);
}

function getProPrices() {
  const p = planById('pro');
  const monthly = p.priceMonthly;
  const yearly = p.priceYearly;
  const has =
    PLUGIN_PROMO.enabled &&
    (promoAppliesTo('monthly') || promoAppliesTo('yearly'));
  return {
    monthly,
    yearly,
    monthlyFinal: promoAppliesTo('monthly') ? applyPromoPrice(monthly) : monthly,
    yearlyFinal: promoAppliesTo('yearly') ? applyPromoPrice(yearly) : yearly,
    hasDiscount: has,
    promo: PLUGIN_PROMO,
  };
}

function formatMoney(n, currency) {
  const c = currency || 'USD';
  return `$${Number(n).toFixed(n % 1 ? 2 : 0)}`;
}

/** Admin + Contributor — Pro/Free narx ko‘rsatish */
function planPriceLabel(p) {
  if (!p || p.id === 'free') return 'Bepul';
  const pr = getProPrices();
  if (pr.hasDiscount && promoAppliesTo('monthly')) {
    return `${formatMoney(pr.monthlyFinal)}/oy · chegirma`;
  }
  return `${formatMoney(p.priceMonthly)}/oy`;
}

function formatProPriceForContributor() {
  const pr = getProPrices();
  const p = planById('pro');
  if (pr.hasDiscount && PLUGIN_PROMO.enabled) {
    return `<span style="text-decoration:line-through;color:var(--tx-3)">${formatMoney(pr.monthly)}</span> <b style="color:var(--green)">${formatMoney(pr.monthlyFinal)}</b> <span class="pill" style="font-size:10px">${PLUGIN_PROMO.code}</span>`;
  }
  return `${formatMoney(p.priceMonthly)}/oy`;
}

function planById(id) {
  const key = String(id).toLowerCase();
  return PLUGIN_PLANS.find((p) => p.id === key) || PLUGIN_PLANS[0];
}

function formatPlanLimit(plan) {
  if (!plan) return '—';
  if (plan.unlimitedDownloads) return 'Cheksiz';
  return `${plan.downloadLimit} / oy`;
}

function normalizePlanLabel(plan) {
  if (!plan) return 'Free';
  const p = String(plan).toLowerCase();
  if (p === 'pro' || p === 'studio') return 'Pro';
  return 'Free';
}

loadPluginPlans();

const CONTRIBUTORS = [];

let TEMPLATES = [];

/** AE Browse obunachilari — API ulanguncha bo'sh */
const SUBSCRIBERS = [];

function cById(id) {
  const fromList = CONTRIBUTORS.find((c) => c.id === id);
  if (fromList) return fromList;
  const t = TEMPLATES.find((x) => x.cid === id);
  if (t?._con) return { id: t._con.id || id, name: t._con.name, email: t._con.email, status: "active" };
  return { id, name: "Contributor", email: "", status: "active" };
}
function sById(id){ return SUBSCRIBERS.find(s=>s.id===id); }
function subscriberCounts(){
  if (typeof window !== "undefined" && window._ASSETFLOW_SUBSCRIBER_STATS) {
    return { ...window._ASSETFLOW_SUBSCRIBER_STATS };
  }
  const active = SUBSCRIBERS.filter(s=>s.status==='active');
  return {
    total: SUBSCRIBERS.length,
    active: active.length,
    blocked: SUBSCRIBERS.filter(s=>s.status==='blocked').length,
    removed: SUBSCRIBERS.filter(s=>s.status==='removed').length,
    online: active.filter(s=>/daq|Bugun|minut|Hozir/i.test(s.lastSeen)).length,
    totalDownloads: SUBSCRIBERS.reduce((a,s)=>a+s.downloads,0),
    free: SUBSCRIBERS.filter(s=>normalizePlanLabel(s.plan)==='Free' && s.status!=='removed').length,
    pro: SUBSCRIBERS.filter(s=>normalizePlanLabel(s.plan)==='Pro' && s.status!=='removed').length,
  };
}

function subscriberUsagePct(s) {
  const plan = planById(normalizePlanLabel(s.plan).toLowerCase());
  if (plan.unlimitedDownloads) return null;
  const used = s.downloadsMonth ?? 0;
  const lim = plan.downloadLimit || 1;
  return Math.min(100, Math.round((used / lim) * 100));
}
function tByStatus(s){ return TEMPLATES.filter(t=>t.status===s); }
function tByContributor(id){ return TEMPLATES.filter(t=>t.cid===id); }
function counts(){
  const st = typeof window !== "undefined" ? window._ASSETFLOW_ADMIN_STATS : null;
  return {
    total: TEMPLATES.length,
    approved: tByStatus('approved').length,
    pending: tByStatus('pending').length,
    soft: tByStatus('soft').length,
    hard: tByStatus('hard').length,
    draft: tByStatus('draft').length,
    archived: tByStatus('archived').length,
    contributors: st ? CONTRIBUTORS.length : CONTRIBUTORS.length,
    blocked: CONTRIBUTORS.filter(c=>c.status==='blocked').length,
    subscribers: SUBSCRIBERS.length,
    subscribersActive: subscriberCounts().active,
    subscribersBlocked: subscriberCounts().blocked,
    totalDl: TEMPLATES.reduce((a,t)=>a+t.dl,0),
  };
}

const ACTIVITY = [];

const DL_7 = [0, 0, 0, 0, 0, 0, 0];
const DL_30 = Array(30).fill(0);

function topTemplates() {
  return TEMPLATES.filter((t) => t.status === "approved")
    .sort((a, b) => b.dl - a.dl)
    .slice(0, 8);
}

const CAT_DIST = [];

function buildCatDist() {
  const counts = {};
  TEMPLATES.forEach((t) => {
    const k = t.cat || "Boshqa";
    counts[k] = (counts[k] || 0) + 1;
  });
  const total = Math.max(TEMPLATES.length, 1);
  const colors = ["#8b7cf6", "#56a0f2", "#34c759", "#ff9f0a", "#ff453a"];
  return Object.entries(counts).map(([nm, n], i) => ({
    nm,
    v: n / total,
    color: colors[i % colors.length],
  }));
}

const REJECT_REASONS = [];

const AUDIT = [];

const AUDIT_META = {
  approve:{cls:'green', ic:'check', label:'Tasdiqlash'},
  soft_reject:{cls:'orange', ic:'reply', label:'Soft reject'},
  hard_reject:{cls:'red', ic:'ban', label:'Hard reject'},
  block:{cls:'red', ic:'ban', label:'Bloklash'},
  unblock:{cls:'green', ic:'check', label:'Blokdan chiqarish'},
  broadcast:{cls:'yellow', ic:'megaphone', label:'Broadcast'},
  template_delete:{cls:'gray', ic:'trash', label:'Shablon o\u2018chirish'},
  sub_block:{cls:'red', ic:'ban', label:'Obunachi bloklandi'},
  sub_remove:{cls:'gray', ic:'trash', label:'Obunachi chiqarildi'},
  sub_restore:{cls:'green', ic:'refresh', label:'Obunachi tiklandi'},
  edit_meta:{cls:'blue', ic:'edit', label:'Metadata tahriri'},
  auto_archive:{cls:'gray', ic:'archive', label:'Avto-arxiv'},
};
