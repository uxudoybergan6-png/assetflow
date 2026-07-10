/* ============================================================
   AssetFlow — UI data (empty by default; filled from API)
   ============================================================ */
// Stock S1 — TEMPLATE_CATEGORIES (apps/api/src/lib/ai/template-metadata.ts) bilan AYNAN
// sinxron ('Uncategorized' bundan mustasno). Backend ro'yxati o'zgarsa, shu yerni ham yangila.
const CATS = ['Titles','Lower Thirds','Transitions','Intros','Logo Reveal','Openers','Slideshows','Backgrounds','LUTs','Overlays','Infographics','Social Media','Logos','Mockups'];
const GRADS = ['g1','g2','g3','g4','g5','g6','g7','g8','g9','g10'];

const CAT_SLUGS = {
  Titles: { cat: "titles", catLabel: "Titles" },
  "Lower Thirds": { cat: "lower-thirds", catLabel: "Lower Thirds" },
  Transitions: { cat: "transitions", catLabel: "Transitions" },
  Intros: { cat: "intros", catLabel: "Intros" },
  "Logo Reveal": { cat: "logo-reveal", catLabel: "Logo Reveal" },
  Openers: { cat: "openers", catLabel: "Openers" },
  Slideshows: { cat: "slideshows", catLabel: "Slideshows" },
  Backgrounds: { cat: "backgrounds", catLabel: "Backgrounds" },
  LUTs: { cat: "luts", catLabel: "LUTs" },
  Overlays: { cat: "overlays", catLabel: "Overlays" },
  Infographics: { cat: "infographics", catLabel: "Infographics" },
  "Social Media": { cat: "social-media", catLabel: "Social Media" },
  Logos: { cat: "logos", catLabel: "Logos" },
  Mockups: { cat: "mockups", catLabel: "Mockups" },
  // Legacy yorliqlar (eski draft'lar) → kanonik kategoriyalar
  "Title / Intro": { cat: "titles", catLabel: "Titles" },
  Slideshow: { cat: "slideshows", catLabel: "Slideshows" },
  YouTube: { cat: "intros", catLabel: "Intros" },
  "Instagram Reels": { cat: "social-media", catLabel: "Social Media" },
};

function catFromLabel(label) {
  return CAT_SLUGS[label] || { cat: "uncategorized", catLabel: label || "Uncategorized" };
}

/* ── Stock S1 — mahsulot turi konstantalari (contributor upload + admin edit) ── */
// Keng Type (web'dagi 4 pill bilan 1:1)
const TEMPLATE_TYPES = [
  { value: "video-templates", label: "Video Templates" },
  { value: "motion-graphics", label: "Motion Graphics" },
  { value: "graphics", label: "Graphics" },
  { value: "luts", label: "LUTs" },
];

// Stock kategoriyalari (S1 sodda ro'yxat; S2'da AI-assisted kengayadi)
const STOCK_CATS = {
  video: ["Nature","People","City","Business","Technology","Abstract","Food","Sports","Travel","Animals"],
  music: ["Cinematic","Corporate","Ambient","Electronic","Hip-Hop","Rock","Pop","Folk","Jazz","Classical"],
  sfx: ["Whoosh","Impact","UI / Interface","Ambience","Foley","Transitions","Glitch","Nature","Mechanical","Voice"],
  photo: ["Nature","People","City","Business","Technology","Abstract","Food","Travel","Animals","Textures"],
};

/** Stock kategoriya yorlig'i → {cat, catLabel} (slug avtomatik). */
function stockCatFromLabel(label) {
  const l = String(label || "").trim();
  if (!l) return { cat: "uncategorized", catLabel: "Uncategorized" };
  return {
    cat: l.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    catLabel: l,
  };
}

/**
 * AE Browse plugin — Free and Pro only
 * downloadLimit: downloads per month; unlimitedDownloads=true means no limit
 */
let PLUGIN_PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'To get started',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    unlimitedDownloads: false,
    downloadLimit: 15,
    importLimit: 10,
    aiMonthlyCredits: 50,
    catalog: 'All approved templates (with watermark)',
    maxResolution: '1080p',
    features: [
      '15 downloads / month',
      '10 AE imports / month',
      'Up to 1080p',
      'Community catalog',
    ],
    active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Professional studio',
    priceMonthly: 19,
    priceYearly: 190,
    currency: 'USD',
    unlimitedDownloads: true,
    downloadLimit: null,
    importLimit: null,
    aiMonthlyCredits: 1000,
    catalog: 'Full catalog + 4K + early access to new releases',
    maxResolution: '4K',
    features: [
      'Unlimited downloads',
      'Unlimited AE imports',
      '4K and pack files',
      'Early access to new templates',
    ],
    active: true,
  },
];

/** Discount / promo code for the Pro plan (managed by admin) */
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

/** Admin + Contributor — show Pro/Free price */
function planPriceLabel(p) {
  if (!p || p.id === 'free') return 'Free';
  const pr = getProPrices();
  if (pr.hasDiscount && promoAppliesTo('monthly')) {
    return `${formatMoney(pr.monthlyFinal)}/mo · discount`;
  }
  return `${formatMoney(p.priceMonthly)}/mo`;
}

function formatProPriceForContributor() {
  const pr = getProPrices();
  const p = planById('pro');
  if (pr.hasDiscount && PLUGIN_PROMO.enabled) {
    return `<span style="text-decoration:line-through;color:var(--tx-3)">${formatMoney(pr.monthly)}</span> <b style="color:var(--green)">${formatMoney(pr.monthlyFinal)}</b> <span class="pill" style="font-size:10px">${PLUGIN_PROMO.code}</span>`;
  }
  return `${formatMoney(p.priceMonthly)}/mo`;
}

function planById(id) {
  const key = String(id).toLowerCase();
  return PLUGIN_PLANS.find((p) => p.id === key) || PLUGIN_PLANS[0];
}

function formatPlanLimit(plan) {
  if (!plan) return '—';
  if (plan.unlimitedDownloads) return 'Unlimited';
  return `${plan.downloadLimit} / mo`;
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
    const k = t.cat || "Other";
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
  approve:{cls:'green', ic:'check', label:'Approve'},
  soft_reject:{cls:'orange', ic:'reply', label:'Soft reject'},
  hard_reject:{cls:'red', ic:'ban', label:'Hard reject'},
  block:{cls:'red', ic:'ban', label:'Block'},
  unblock:{cls:'green', ic:'check', label:'Unblock'},
  broadcast:{cls:'yellow', ic:'megaphone', label:'Broadcast'},
  template_delete:{cls:'gray', ic:'trash', label:'Template deleted'},
  sub_block:{cls:'red', ic:'ban', label:'Subscriber blocked'},
  sub_remove:{cls:'gray', ic:'trash', label:'Subscriber removed'},
  sub_restore:{cls:'green', ic:'refresh', label:'Subscriber restored'},
  edit_meta:{cls:'blue', ic:'edit', label:'Metadata edit'},
  auto_archive:{cls:'gray', ic:'archive', label:'Auto-archive'},
};
