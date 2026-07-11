(() => {
  "use strict";

  const groups = [
    ["Home", [["home", "Landing · complete"], ["home-mega", "Mega-menu open"], ["dashboard", "User dashboard"]]],
    ["Templates", [["templates", "Catalog & filters"], ["template-detail", "Detail & Pro gate"]]],
    ["AI Studio", [["ai-image", "Image composer"], ["ai-video", "Video + open selectors"], ["ai-draw", "Draw canvas"], ["ai-voice", "Voice composer"], ["ai-audio", "SFX & audio"], ["ai-upscale", "Image / video upscale"], ["ai-history", "Sessions & history"], ["ai-models", "Model picker"]]],
    ["Projects", [["projects", "Projects list"], ["project-detail", "Populated project"]]],
    ["Account & Auth", [["account-profile", "Profile"], ["account-billing", "Plan & credits"], ["account-downloads", "Downloads"], ["login", "Sign in"], ["register", "Register"], ["forgot", "Forgot password"], ["verify-email", "Verify email"]]],
    ["Pages", [["pricing", "Pricing"], ["plugin", "Plugin download"], ["help", "Help & FAQ"], ["legal-terms", "Terms"], ["legal-privacy", "Privacy"], ["legal-refund", "Refund policy"], ["legal-dmca", "DMCA"]]],
    ["States", [["state-empty", "Empty gallery"], ["state-generating", "Generating"], ["state-error", "Error + refund toast"], ["state-moderation", "Moderation refund"], ["state-low-credits", "Low credits / top up"], ["state-no-results", "No catalog results"], ["state-lightbox", "Media lightbox"], ["state-project-modal", "Add to project"], ["state-project-empty", "Empty project"], ["state-reference-library", "Reference library"], ["state-avatar-menu", "Avatar menu open"], ["state-delete", "Delete account"]]],
  ];

  const activeModels = [
    { group: "IMAGE · TEXT & EDIT", code: "NB2", name: "Nano Banana 2", detail: "1:1—21:9 · 1K / 2K / 4K · image references", cost: "✦ 4 / 8 / 16" },
    { group: "IMAGE · TEXT & EDIT", code: "NBL", name: "Nano Banana 2 Lite", detail: "1:1—21:9 · 1K · fastest image tier", cost: "✦ 2" },
    { group: "IMAGE · TEXT & EDIT", code: "NBP", name: "Nano Banana Pro", detail: "1:1—21:9 · 1K / 2K / 4K · premium", cost: "✦ 8 / 14 / 24" },
    { group: "IMAGE · TEXT", code: "I4", name: "Imagen 4", detail: "1:1 · 3:4 · 4:3 · 16:9 · 9:16 · 1K / 2K", cost: "✦ 4 / 6" },
    { group: "IMAGE · TEXT", code: "I4U", name: "Imagen 4 Ultra", detail: "1:1 · 3:4 · 4:3 · 16:9 · 9:16 · 1K / 2K", cost: "✦ 6 / 10" },
    { group: "IMAGE · UTILITY", code: "UP", name: "Imagen Upscale", detail: "Required image · x2 / x4", cost: "✦ 4 / 8" },
    { group: "IMAGE · TEXT & EDIT", code: "S5", name: "Seedream 5.0 Pro", detail: "1:1—21:9 · 1K / 2K · up to 10 refs", cost: "✦ 4 / 8" },
    { group: "VIDEO", code: "V3L", name: "Veo 3.1 Lite", detail: "16:9 / 9:16 · 720p · 4 / 6 / 8s", cost: "✦ 3/sec" },
    { group: "VIDEO", code: "V3F", name: "Veo 3.1 Fast (Google Cloud)", detail: "16:9 / 9:16 · 720p / 1080p · 4 / 6 / 8s", cost: "✦ 8/sec" },
    { group: "VIDEO", code: "OMNI", name: "Gemini Omni Flash (Google Cloud)", detail: "16:9 / 9:16 · 720p · 10s · native audio", cost: "✦ 80/gen" },
    { group: "VIDEO", code: "V3", name: "Veo 3.1", detail: "16:9 / 9:16 · 720p / 1080p · 4 / 6 / 8s", cost: "✦ 30/sec" },
    { group: "VIDEO · UTILITY", code: "TOP", name: "Video Upscale (Topaz)", detail: "Auto aspect · 720p / 1080p / 4K · up to 300s", cost: "✦ 2 / 3 / 9 sec" },
    { group: "VIDEO", code: "S2", name: "Seedance 2.0", detail: "Auto—9:16 · 480p / 720p / 1080p / 4K · 4—15s", cost: "✦ 8 / 15 / 34 / 60 sec" },
    { group: "AUDIO", code: "C3", name: "Chirp 3 HD", detail: "Voice · 18 voices · 10 languages · max 1,000 chars", cost: "✦ 4" },
    { group: "AUDIO", code: "SFX", name: "ElevenLabs SFX", detail: "Sound effects · 3 / 5 / 10s", cost: "✦ 4" },
  ];

  const plans = [
    { name: "Free", price: 0, credits: "50 credits/mo", sub: "For trying it out", cta: "Get started", features: ["50 AI credits per month", "HD template library", "Watermarked export", "1 active project", "Community support"] },
    { name: "Pro", price: 19, credits: "1,000 credits/mo", sub: "For professionals", cta: "Upgrade to Pro", popular: true, features: ["1,000 AI credits per month", "All 10,000+ templates", "4K, watermark-free downloads", "Unlimited projects", "AE / Premiere plugin", "Priority generation", "Email support"] },
    { name: "Studio", price: 59, credits: "6,000 credits/mo", sub: "For teams", cta: "Choose Studio", features: ["6,000 AI credits per month", "Everything in Pro", "Team workspace (5 seats)", "Brand kit and templates", "API access", "Priority render queue", "Dedicated account manager"] },
  ];

  const nav = document.getElementById("screenNav");
  groups.forEach(([label, items]) => {
    const section = document.createElement("section");
    section.className = "nav-group";
    section.innerHTML = `<button type="button" aria-expanded="true">${label}</button><div class="nav-items">${items.map(([id, title]) => `<button type="button" data-go="${id}">${title}</button>`).join("")}</div>`;
    section.firstElementChild.addEventListener("click", () => {
      section.classList.toggle("is-collapsed");
      section.firstElementChild.setAttribute("aria-expanded", String(!section.classList.contains("is-collapsed")));
    });
    nav.appendChild(section);
  });

  function appHeader(active) {
    const links = [["dashboard", "Home"], ["templates", "Templates"], ["ai-image", "AI Studio"], ["projects", "Projects"]];
    let key = active;
    if (active.startsWith("ai-") || active.startsWith("state-")) key = "ai-image";
    if (active.startsWith("account-")) key = "account-profile";
    return `<header class="app-header"><a class="brand" data-go="home" href="#home"><span class="brand-mark">ϟ</span>FrameFlow</a><nav>${links.map(([id, label]) => `<button data-go="${id}" class="${key === id ? "active" : ""}">${label}</button>`).join("")}</nav><label class="global-search">⌕<input aria-label="Search FrameFlow" placeholder="Search templates, generations…"><kbd>⌘K</kbd></label><button class="credit-pill" data-go="state-low-credits">✦ 742 · PRO</button><button class="avatar avatar-button" data-go="state-avatar-menu" aria-label="Open account menu">AK</button></header>`;
  }
  document.querySelectorAll("[data-app-shell]").forEach((node) => { node.outerHTML = appHeader(node.dataset.appShell); });

  function sessionRail(history) {
    return `<aside class="session-rail"><button class="new-session">＋ New session</button><button class="library-row ${history ? "active" : ""}" data-go="ai-history"><span class="session-thumb"></span><b>My Library</b></button><span class="rail-label">SESSIONS</span><button class="session-row active"><span class="session-thumb"></span><b>Campaign explorations<small>12 visuals · 4 audio</small></b></button><button class="session-row"><span class="session-thumb"></span><b>Brand film<small>8 visuals · today</small></b></button><button class="session-row"><span class="session-thumb"></span><b>Social cuts<small>6 visuals · Jul 11</small></b></button><button class="session-row"><span class="session-thumb"></span><b>Product stills<small>10 visuals · Jul 9</small></b></button><button class="session-row"><span class="session-thumb"></span><b>Voiceover tests<small>4 audio · Jul 8</small></b></button></aside>`;
  }
  document.querySelectorAll("[data-session-rail]").forEach((node) => { node.outerHTML = sessionRail(node.hasAttribute("data-session-rail") && node.dataset.sessionRail === "history"); });

  function accountView(tab) {
    const tabs = [["profile", "Profile", "account-profile"], ["billing", "Subscription & credits", "account-billing"], ["downloads", "Downloads", "account-downloads"]];
    let content = "";
    if (tab === "profile") {
      content = `<div class="account-grid"><section class="account-card"><div class="profile-row"><span class="avatar">AK</span><div><b>Alex Kim</b><span>alex@frameflow.app</span></div><button class="secondary" style="margin-left:auto">Change photo</button></div><div class="field-grid"><div class="field"><label>FULL NAME<input value="Alex Kim"></label></div><div class="field"><label>EMAIL<input value="alex@frameflow.app" readonly></label></div></div><button class="primary">Save changes</button></section><div><section class="account-card stat-card"><span>CREDIT BALANCE</span><strong>✦ 742</strong><small>1,000 monthly · resets Aug 12</small></section><section class="account-card stat-card" style="margin-top:15px"><span>DOWNLOADS THIS MONTH</span><strong>38</strong><small>Unlimited on Pro</small></section></div><section class="account-card" style="grid-column:span 2"><span class="kicker">SECURITY & DATA</span><div class="security-list"><div><b>Password</b><button class="secondary">Change password</button></div><div><span>Download a copy of your FrameFlow data</span><button class="secondary">Export data</button></div><div><span>Delete your account and all stored content</span><button class="danger-btn" data-go="state-delete">Delete account</button></div></div></section></div>`;
    } else if (tab === "billing") {
      content = `<div class="account-grid"><section class="account-card plan-card"><div class="current-plan"><span class="kicker">CURRENT PLAN</span><h2>Pro · $19/mo</h2><p>Renews August 12, 2026</p><ul><li>1,000 credits every month</li><li>Unlimited 4K template downloads</li><li>AE / Premiere plugin</li></ul><button class="secondary" data-go="pricing">Compare plans</button></div><div class="credit-balance-card"><span class="kicker">CREDIT BALANCE</span><strong>✦ 742</strong><p>Monthly credits are used first. Purchased credits never expire.</p><div class="credit-mini-packs"><button>✦ 500<br><b>$5</b></button><button>✦ 1,500<br><b>$12</b></button><button>✦ 5,000<br><b>$35</b></button></div></div></section><section class="account-table"><h3>Credit activity</h3><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>BALANCE</th></tr></thead><tbody><tr><td>Jul 12</td><td>Seedance 2.0 · 8 seconds</td><td>− ✦ 120</td><td>✦ 742</td></tr><tr><td>Jul 12</td><td>Moderation refund</td><td style="color:var(--success)">+ ✦ 8</td><td>✦ 862</td></tr><tr><td>Jul 11</td><td>Nano Banana Pro · 2K</td><td>− ✦ 14</td><td>✦ 854</td></tr></tbody></table></section></div>`;
    } else {
      content = `<div class="account-grid"><section class="account-card downloads-list"><span class="kicker">DOWNLOAD HISTORY</span><h2 style="font-size:30px;margin:12px 0 20px">Your downloaded templates</h2>${[["art-red","Football Championship Logo Reveal","After Effects · 4K · 48.6 MB","Today"],["art-green","Organic Shapes Pack","After Effects · 4K · 22.1 MB","Jul 11"],["art-sunset","Golden Hour Product Opener","Premiere Pro · HD · 31.4 MB","Jul 8"],["art-blue","Editorial Type System","After Effects · 4K · 56.8 MB","Jul 3"]].map((x) => `<div class="download-row"><span class="mini-art ${x[0]}"></span><div><b>${x[1]}</b><small>${x[2]}</small></div><span>${x[3]}</span><button class="secondary">Download ↓</button></div>`).join("")}</section></div>`;
    }
    return `<div class="account-content"><div class="account-head"><div><span class="kicker">YOUR FRAMEFLOW</span><h1>Account</h1></div><div class="account-tabs">${tabs.map(([id, label, go]) => `<button data-go="${go}" class="${id === tab ? "active" : ""}">${label}</button>`).join("")}</div></div>${content}</div>`;
  }
  document.querySelectorAll("[data-account-shell]").forEach((node) => { node.outerHTML = accountView(node.dataset.accountShell); });

  function authView(mode) {
    if (mode === "verify") return `<div class="auth-form-wrap"><div class="verify-card"><a class="brand" data-go="home" style="justify-content:center"><span class="brand-mark">ϟ</span>FrameFlow</a><span class="mail-icon">✉</span><span class="kicker">ONE MORE STEP</span><h1>Check your inbox.</h1><p>We sent a verification link to <b>alex@frameflow.app</b>. Open it to unlock AI generation and downloads.</p><button class="primary full">Resend verification email</button><button class="text-btn" data-go="login">Use a different account</button></div></div>`;
    const register = mode === "register";
    const forgot = mode === "forgot";
    const title = register ? "Create your account." : forgot ? "Reset your password." : "Welcome back.";
    const sub = register ? "Start with 50 free AI credits. No card required." : forgot ? "We’ll send a secure reset link to your inbox." : "Sign in to keep your creative work moving.";
    return `<div class="auth-layout"><div class="auth-art"><a class="brand" data-go="home"><span class="brand-mark">ϟ</span>FrameFlow</a><div class="auth-visual"><div class="media-art ${register ? "art-blue" : forgot ? "art-mono" : "art-aurora"}"></div></div><div class="auth-quote"><span class="kicker">ONE ACCOUNT · EVERY WORKFLOW</span><h2>${register ? "Your next frame starts here." : "The work is right where you left it."}</h2><p>Templates, AI Studio and the timeline—connected.</p></div></div><div class="auth-form-wrap"><form class="auth-form" onsubmit="return false"><a class="brand" data-go="home"><span class="brand-mark">ϟ</span>FrameFlow</a><h1>${title}</h1><p>${sub}</p>${register ? `<div class="field"><label>NAME<input value="Alex Kim"></label></div>` : ""}<div class="field"><label>EMAIL<input value="alex@frameflow.app" type="email"></label></div>${forgot ? "" : `<div class="field"><label>PASSWORD<input value="password" type="password"></label></div>`}${register ? `<div class="turnstile"><span>□ I’m human</span><i></i><small>TURNSTILE</small></div>` : ""}<button class="primary full auth-submit">${register ? "Create free account" : forgot ? "Send reset link" : "Sign in"} →</button>${forgot ? "" : `<div class="divider"><i></i><span>OR</span><i></i></div><button class="google-btn">G&nbsp;&nbsp; Continue with Google</button>`}<div class="auth-switch">${register ? `Already have an account? <button data-go="login">Sign in</button>` : forgot ? `<button data-go="login">← Back to sign in</button>` : `New to FrameFlow? <button data-go="register">Create account</button> · <button data-go="forgot">Forgot password?</button>`}</div></form></div></div>`;
  }
  document.querySelectorAll("[data-auth-shell]").forEach((node) => { node.outerHTML = authView(node.dataset.authShell); });

  function marketingHead(active) {
    return `<header class="site-head wide"><a class="brand" data-go="home"><span class="brand-mark">ϟ</span>FrameFlow</a><nav><button data-go="templates">Templates</button><button data-go="ai-image">AI Studio</button><button data-go="pricing" class="${active === "pricing" ? "active" : ""}">Pricing</button><button data-go="plugin" class="${active === "plugin" ? "active" : ""}">Plugin</button></nav><div class="head-actions"><button class="text-btn" data-go="login">Sign in</button><button class="primary" data-go="register">Start for free</button></div></header>`;
  }
  document.querySelectorAll("[data-marketing-head]").forEach((node) => { node.outerHTML = marketingHead(node.dataset.marketingHead); });
  // Footer ustunlari real platforma footerCols bilan 1:1 (Product/Categories/Plugins/Company)
  const footer = `<footer class="site-footer"><div><a class="brand" data-go="home"><span class="brand-mark">ϟ</span>FrameFlow</a><p>Templates and AI Studio for motion designers and video creators.</p></div><div><b>PRODUCT</b><a data-go="templates">Templates</a><a data-go="ai-image">AI Studio</a><a data-go="plugin">Plugin</a><a data-go="pricing">Pricing</a><a>Changelog</a></div><div><b>CATEGORIES</b><a data-go="templates">Video Templates</a><a data-go="templates">Lower Thirds</a><a data-go="templates">Transitions</a><a data-go="templates">LUT &amp; Presets</a><a data-go="ai-audio">SFX</a></div><div><b>PLUGINS</b><a data-go="plugin">After Effects</a><a data-go="plugin">Premiere Pro</a><a data-go="plugin">DaVinci Resolve</a><a data-go="plugin">Final Cut</a><a data-go="plugin">Installation</a></div><div><b>COMPANY</b><a>About us</a><a>Careers</a><a>Blog</a><a data-go="help">Contact</a><a>Partnerships</a></div><div class="footer-cta"><span>© 2026 FRAMEFLOW</span><div class="footer-legal"><a data-go="legal-terms">Terms</a><a data-go="legal-privacy">Privacy</a><a data-go="legal-refund">Refunds</a><a data-go="legal-dmca">DMCA</a></div><button class="primary" data-go="register">Start creating →</button></div></footer>`;
  document.querySelectorAll("[data-marketing-footer]").forEach((node) => { node.outerHTML = footer; });
  document.querySelectorAll("[data-pricing-grid]").forEach((node) => {
    node.outerHTML = `<div class="pricing-grid">${plans.map((p) => `<article class="price-card ${p.popular ? "featured" : ""}">${p.popular ? `<span class="popular-label">MOST POPULAR</span>` : ""}<span class="kicker">${p.name.toUpperCase()}</span><h3>${p.sub}</h3><div class="price">$${p.price}<small>/mo</small></div><small>${p.credits}</small><ul>${p.features.map((f) => `<li>${f}</li>`).join("")}</ul><button class="${p.popular ? "primary" : "secondary"}">${p.name === "Free" ? "Get started" : `Choose ${p.name}`} →</button></article>`).join("")}</div>`;
  });

  const legalDocs = {
    terms: { title: "Terms of Service", updated: "Effective June 17, 2026", intro: "These terms govern your use of FrameFlow, including the web platform, AI Studio, downloadable templates and creative plugins.", sections: [["1. Your account", "You are responsible for your account, credentials and activity. You must provide accurate information and keep access secure."], ["2. Plans, credits and billing", "Plans include the features shown at checkout. AI credits are consumed according to the model and settings shown before generation. Credits have no cash value."], ["3. Templates and licenses", "A valid plan grants a non-exclusive commercial license for end projects. You may not resell, redistribute or offer source files as standalone assets."], ["4. AI-generated content", "You retain rights in eligible inputs and outputs subject to applicable law and provider terms. You must have permission to upload references."], ["5. Acceptable use", "Do not use FrameFlow for illegal, deceptive, abusive or non-consensual content, or to infringe intellectual property or privacy rights."]] },
    privacy: { title: "Privacy Policy", updated: "Effective June 17, 2026", intro: "This policy explains what FrameFlow collects, why we use it and the choices available to you.", sections: [["1. Information we collect", "Account data, billing status, generation prompts and references, project data, support messages and technical usage information."], ["2. How we use information", "To operate the service, process generations, secure accounts, provide support, improve performance and meet legal obligations."], ["3. Service providers", "We use infrastructure, payment, email and AI providers only as needed to deliver the service. They process data under their own terms and our agreements."], ["4. Storage and retention", "Generated assets and saved references are retained according to product and plan settings. You can delete content and request account deletion."], ["5. Your choices", "You may access, export, correct or delete personal data from Account settings or by contacting privacy@getframeflow.app."]] },
    refund: { title: "Refund Policy", updated: "Effective June 17, 2026", intro: "FrameFlow offers a clear refund path for subscriptions and automatic credit restoration for eligible failed generations.", sections: [["1. Subscription guarantee", "New subscription purchases include a 14-day money-back guarantee unless local law provides a longer period."], ["2. Credit packs", "Purchased credit packs are normally non-refundable once credits have been used. Unused accidental duplicate purchases may be reviewed."], ["3. Failed generations", "When an eligible generation fails before an asset is delivered, the charged credits are automatically returned to the same balance."], ["4. Moderation refunds", "References rejected by automated safety checks do not consume credits. The interface confirms the restored amount."], ["5. Requesting a refund", "Contact support@getframeflow.app with the account email, order details and reason. Approved refunds return to the original payment method."]] },
    dmca: { title: "DMCA & Copyright", updated: "Effective June 17, 2026", intro: "FrameFlow respects intellectual-property rights and responds to valid copyright notices and counter-notices.", sections: [["1. Reporting infringement", "Send a signed notice identifying the protected work, the allegedly infringing material, its location and your contact information."], ["2. Good-faith statement", "Your notice must state that you believe in good faith that the use is not authorized by the owner, agent or law."], ["3. Counter-notice", "A user may submit a counter-notice identifying removed material and consenting to the relevant legal jurisdiction."], ["4. Repeat infringers", "FrameFlow may suspend or terminate accounts that repeatedly infringe intellectual-property rights."], ["5. Contact", "Send copyright notices to legal@getframeflow.app. Misrepresentations may create liability, so consider legal advice before filing."]] },
  };
  function legalView(key) {
    const d = legalDocs[key];
    return `<div class="legal-layout">${marketingHead("")}<div class="legal-body"><aside class="legal-aside"><span>ON THIS PAGE</span><nav>${d.sections.map((s, i) => `<button class="${i === 0 ? "active" : ""}">${s[0]}</button>`).join("")}</nav></aside><main class="legal-copy"><span class="kicker">LEGAL · FRAMEFLOW</span><h1>${d.title}</h1><p class="updated">${d.updated}</p><article><p>${d.intro}</p></article>${d.sections.map((s) => `<article><h2>${s[0]}</h2><p>${s[1]}</p></article>`).join("")}</main></div>${footer}</div>`;
  }
  document.querySelectorAll("[data-legal]").forEach((node) => { node.outerHTML = legalView(node.dataset.legal); });

  const modelList = document.getElementById("modelList");
  let lastGroup = "";
  activeModels.forEach((m) => {
    if (m.group !== lastGroup) {
      modelList.insertAdjacentHTML("beforeend", `<div class="model-group-title">${m.group}</div>`);
      lastGroup = m.group;
    }
    modelList.insertAdjacentHTML("beforeend", `<div class="model-row"><span class="model-logo">${m.code}</span><div><b>${m.name}</b><small>${m.detail}</small></div><span class="model-cost">${m.cost}</span><button>Select</button></div>`);
  });

  function go(id, updateHash = true) {
    const target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s === target));
    document.querySelectorAll(".nav-items [data-go]").forEach((b) => b.classList.toggle("active", b.dataset.go === id));
    document.title = `FrameFlow · ${target.dataset.title || id} · Batch 6`;
    if (updateHash) history.replaceState(null, "", `#${id}`);
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (event) => {
    const goButton = event.target.closest("[data-go]");
    if (goButton) { event.preventDefault(); go(goButton.dataset.go); }
  });
  const initial = location.hash.slice(1);
  go(document.getElementById(initial) ? initial : "home", false);
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (document.getElementById(next)) go(next, false);
  });

  document.querySelectorAll("[data-theme-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      document.documentElement.dataset.theme = button.dataset.themePick;
      document.querySelectorAll("[data-theme-pick]").forEach((b) => b.classList.toggle("active", b === button));
      localStorage.setItem("ff-batch6-theme", button.dataset.themePick);
    });
  });
  const savedTheme = localStorage.getItem("ff-batch6-theme");
  if (["noir", "neon", "cold"].includes(savedTheme)) document.querySelector(`[data-theme-pick="${savedTheme}"]`).click();

  const mockbar = document.querySelector(".mockbar");
  document.querySelector(".mockbar__collapse").addEventListener("click", () => mockbar.classList.add("is-closed"));
  document.querySelector(".mockbar-open").addEventListener("click", () => mockbar.classList.remove("is-closed"));
  document.getElementById("screenSearch").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase().trim();
    document.querySelectorAll(".nav-group").forEach((group) => {
      let visible = 0;
      group.querySelectorAll(".nav-items button").forEach((button) => {
        const show = !query || button.textContent.toLowerCase().includes(query);
        button.style.display = show ? "flex" : "none";
        if (show) visible += 1;
      });
      group.style.display = visible ? "block" : "none";
      if (query) group.classList.remove("is-collapsed");
    });
  });

  const screenCount = document.querySelectorAll(".screen").length;
  document.getElementById("coverageCount").textContent = `${screenCount} screens`;
})();
