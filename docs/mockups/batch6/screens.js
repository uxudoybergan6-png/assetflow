(() => {
  "use strict";

  const groups = [
    ["Home", [["home", "Landing · complete"], ["home-mega", "Mega-menu open"], ["dashboard", "User dashboard"]]],
    ["Templates", [["templates", "Catalog & filters"], ["template-detail", "Detail & Pro gate"]]],
    ["AI Studio", [["ai-image", "Image composer"], ["ai-video", "Video + open selectors"], ["ai-draw", "Draw canvas"], ["ai-voice", "Voice composer"], ["ai-audio", "SFX & audio"], ["ai-upscale", "Image / video upscale"], ["ai-history", "Sessions & history"], ["ai-models", "Model picker"]]],
    ["Projects", [["projects", "Projects list"], ["project-detail", "Populated project"]]],
    ["Account & Auth", [["account-profile", "Profile"], ["account-billing", "Plan & credits"], ["account-downloads", "Downloads"], ["login", "Sign in"], ["register", "Register"], ["forgot", "Forgot password"], ["reset-password", "Set new password"], ["verify-email", "Verify email"]]],
    ["Pages", [["pricing", "Pricing"], ["plugin", "Plugin download"], ["help", "Help & FAQ"], ["legal-terms", "Terms"], ["legal-privacy", "Privacy"], ["legal-refund", "Refund policy"], ["legal-dmca", "DMCA"]]],
    ["States", [["state-empty", "Empty gallery"], ["state-generating", "Generating"], ["state-error", "Toasts: error + success"], ["state-session-expired", "Session expired"], ["state-email-verified", "Email verified"], ["state-device-confirm", "Plugin device confirm"], ["state-moderation", "Moderation refund"], ["state-low-credits", "Low credits / top up"], ["state-no-results", "No catalog results"], ["state-lightbox", "Media lightbox"], ["state-select-mode", "Library bulk select"], ["state-project-modal", "Add to project"], ["state-project-empty", "Empty project"], ["state-reference-library", "Reference library"], ["state-avatar-menu", "Avatar menu open"], ["state-delete", "Delete account"]]],
  ];

  const activeModels = [
    { group: "IMAGE · TEXT & EDIT", code: "NB2", name: "Nano Banana 2", detail: "1:1—21:9 · 1K / 2K / 4K · image references", cost: "✦ 4 / 8 / 16" },
    { group: "IMAGE · TEXT & EDIT", code: "NBL", name: "Nano Banana 2 Lite", detail: "1:1—21:9 · 1K · fastest image tier", cost: "✦ 2" },
    { group: "IMAGE · TEXT & EDIT", code: "NBP", name: "Nano Banana Pro", detail: "1:1—21:9 · 1K / 2K / 4K · premium", cost: "✦ 8 / 14 / 24" },
    { group: "IMAGE · TEXT & EDIT", code: "S5", name: "Seedream 5.0 Pro", detail: "1:1—21:9 · 1K / 2K · up to 10 refs", cost: "✦ 4 / 8" },
    { group: "IMAGE · TEXT", code: "I4", name: "Imagen 4", detail: "1:1 · 3:4 · 4:3 · 16:9 · 9:16 · 1K / 2K", cost: "✦ 4 / 6" },
    { group: "IMAGE · TEXT", code: "I4U", name: "Imagen 4 Ultra", detail: "1:1 · 3:4 · 4:3 · 16:9 · 9:16 · 1K / 2K", cost: "✦ 6 / 10" },
    { group: "IMAGE · UTILITY", code: "UP", name: "Imagen Upscale", detail: "Required image · x2 / x4", cost: "✦ 4 / 8" },
    { group: "VIDEO", code: "V3L", name: "Veo 3.1 Lite", detail: "16:9 / 9:16 · 720p · 4 / 6 / 8s", cost: "✦ 3/sec" },
    { group: "VIDEO", code: "V3F", name: "Veo 3.1 Fast (Google Cloud)", detail: "16:9 / 9:16 · 720p / 1080p · 4 / 6 / 8s", cost: "✦ 8/sec" },
    { group: "VIDEO", code: "OMNI", name: "Gemini Omni Flash (Google Cloud)", detail: "16:9 / 9:16 · 720p · 10s · native audio", cost: "✦ 80/gen" },
    { group: "VIDEO", code: "V3", name: "Veo 3.1", detail: "16:9 / 9:16 · 720p / 1080p · 4 / 6 / 8s", cost: "✦ 30/sec" },
    { group: "VIDEO · UTILITY", code: "TOP", name: "Video Upscale (Topaz)", detail: "Auto aspect · 720p / 1080p / 4K · up to 300s", cost: "✦ 2 / 3 / 9 per sec" },
    { group: "VIDEO", code: "S2", name: "Seedance 2.0", detail: "Auto / 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 · 480p—4K · 4—15s · multimodal refs", cost: "✦ 8 / 15 / 34 / 60 per sec" },
    { group: "AUDIO", code: "C3", name: "Chirp 3 HD", detail: "Voice · 18 voices · 10 languages · max 1,000 chars", cost: "✦ 4" },
    { group: "AUDIO", code: "SFX", name: "ElevenLabs SFX", detail: "Sound effects · 3 / 5 / 10s", cost: "✦ 4" },
  ];

  const plans = [
    { name: "Free", price: 0, credits: "50 credits/mo", sub: "For trying it out", cta: "Get started", features: ["50 AI credits per month", "HD template library", "Watermarked export", "1 active project", "Community support"] },
    { name: "Pro", price: 19, credits: "1,000 credits/mo", sub: "For professionals", cta: "Upgrade to Pro", popular: true, features: ["1,000 AI credits per month", "Current published template catalog", "4K, watermark-free downloads", "Unlimited projects", "After Effects plugin", "Priority generation", "Email support"] },
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
      content = `<div class="account-grid"><section class="account-card"><div class="profile-row"><span class="avatar">AK</span><div><b>Alex Kim</b><span>alex@example.com</span></div><button class="secondary" style="margin-left:auto">Change photo</button></div><div class="field-grid"><div class="field"><label>FULL NAME<input value="Alex Kim"></label></div><div class="field"><label>EMAIL<input value="alex@example.com" readonly></label></div></div><button class="primary">Save changes</button></section><div><section class="account-card stat-card"><span>CREDIT BALANCE</span><strong>✦ 742</strong><small>1,000 monthly · resets Aug 1</small></section><section class="account-card stat-card" style="margin-top:15px"><span>DOWNLOADS THIS MONTH</span><strong>38</strong><small>Unlimited on Pro</small></section></div><section class="account-card storage-card" style="grid-column:span 2"><div><span class="kicker">STORAGE · AI RESULTS</span><b>3.8 GB of 5 GB</b></div><span class="storage-bar"><i></i></span><small>Generated assets and saved references · Pro allowance</small></section><section class="account-card" style="grid-column:span 2"><span class="kicker">SECURITY & DATA</span><div class="security-list"><div><b>Password</b><button class="secondary">Change password</button></div><div><span>Download a copy of your FrameFlow data</span><button class="secondary">Export data</button></div><div><span>Anonymize personal data, revoke access and unpublish contributed templates</span><button class="danger-btn" data-go="state-delete">Delete account</button></div></div></section></div>`;
    } else if (tab === "billing") {
      content = `<div class="account-grid"><section class="account-card plan-card"><div class="current-plan"><span class="kicker">CURRENT PLAN</span><h2>Pro · $19/mo</h2><p>Renews August 12, 2026 · via Lemon Squeezy</p><ul><li>1,000 credits every month</li><li>Unlimited 4K template downloads</li><li>After Effects plugin</li></ul><button class="secondary" data-go="pricing">Compare plans</button></div><div class="credit-balance-card"><span class="kicker">CREDIT BALANCE</span><strong>✦ 742</strong><p>Monthly credits are used first. Purchased credits never expire.</p><div class="credit-mini-packs"><button>✦ 500<br><b>$5</b></button><button>✦ 1,500<br><b>$12</b></button><button>✦ 5,000<br><b>$35</b></button></div></div></section><section class="account-table"><h3>Recent AI credit activity</h3><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody><tr><td>Jul 12</td><td>Seedance 2.0 · 720p · 8 seconds</td><td>− ✦ 120</td><td>Complete</td></tr><tr><td>Jul 11</td><td>Nano Banana Pro · 2K</td><td>− ✦ 14</td><td>Complete</td></tr><tr><td>Jul 11</td><td>Imagen 4 · 2K</td><td>− ✦ 6</td><td>Complete</td></tr></tbody></table></section></div>`;
    } else {
      content = `<div class="account-grid"><section class="account-card downloads-list"><span class="kicker">DOWNLOAD HISTORY</span><h2 style="font-size:30px;margin:12px 0 20px">Your downloaded templates</h2><div class="empty-state"><span>↓</span><h2>History is coming soon.</h2><p>This month’s live download count is already shown on your Profile. Individual download rows are not exposed yet.</p><button class="secondary" data-go="templates">Browse published templates</button></div></section></div>`;
    }
    return `<div class="account-content"><div class="account-head"><div><span class="kicker">YOUR FRAMEFLOW</span><h1>Account</h1></div><div class="account-tabs">${tabs.map(([id, label, go]) => `<button data-go="${go}" class="${id === tab ? "active" : ""}">${label}</button>`).join("")}</div></div>${content}</div>`;
  }
  document.querySelectorAll("[data-account-shell]").forEach((node) => { node.outerHTML = accountView(node.dataset.accountShell); });

  function authView(mode) {
    if (mode === "verify") return `<div class="auth-form-wrap"><div class="verify-card"><a class="brand" data-go="home" href="#home" style="justify-content:center"><span class="brand-mark">ϟ</span>FrameFlow</a><span class="mail-icon">✉</span><span class="kicker">ONE MORE STEP</span><h1>Check your inbox.</h1><p>A verification link was sent to <b>alex@example.com</b>. Click the link, then press “Check” to unlock AI generation.</p><button class="primary full">Check →</button><button class="secondary full">Resend verification email</button><button class="text-btn" data-go="login">Use a different account</button></div></div>`;
    if (mode === "reset") return `<div class="auth-form-wrap"><form class="auth-form" onsubmit="return false"><a class="brand" data-go="home" href="#home"><span class="brand-mark">ϟ</span>FrameFlow</a><h1>Set a new password.</h1><p>The reset link is valid for 60 minutes and works once. Choose a new password for <b>alex@example.com</b>.</p><div class="field"><label>NEW PASSWORD<input value="password" type="password"></label><small class="field-hint">At least 8 characters</small></div><div class="field"><label>REPEAT NEW PASSWORD<input value="password" type="password"></label></div><button class="primary full auth-submit">Save new password →</button><div class="auth-switch"><button type="button" data-go="login">← Back to sign in</button></div></form></div>`;
    const register = mode === "register";
    const forgot = mode === "forgot";
    const title = register ? "Create your account." : forgot ? "Reset your password." : "Welcome back.";
    const sub = register ? "Start with 50 free AI credits. No card required." : forgot ? "We’ll send a secure reset link to your inbox." : "Sign in to keep your creative work moving.";
    return `<div class="auth-layout"><div class="auth-art"><a class="brand" data-go="home" href="#home"><span class="brand-mark">ϟ</span>FrameFlow</a><div class="auth-visual"><div class="media-art ${register ? "art-blue" : forgot ? "art-mono" : "art-aurora"}"></div></div><div class="auth-quote"><span class="kicker">ONE ACCOUNT · EVERY WORKFLOW</span><h2>${register ? "Your next frame starts here." : "The work is right where you left it."}</h2><p>Templates, AI Studio and the timeline—connected.</p></div></div><div class="auth-form-wrap"><form class="auth-form" onsubmit="return false"><a class="brand" data-go="home" href="#home"><span class="brand-mark">ϟ</span>FrameFlow</a><h1>${title}</h1><p>${sub}</p>${register ? `<div class="field"><label>NAME<input value="Alex Kim"></label></div>` : ""}<div class="field"><label>EMAIL<input value="alex@example.com" type="email"></label></div>${forgot ? "" : `<div class="field"><label>PASSWORD<input value="password" type="password"></label>${register ? `<small class="field-hint">At least 8 characters</small>` : ""}</div>`}${register ? `<div class="turnstile"><span>□ I’m human</span><i></i><small>TURNSTILE</small></div>` : ""}<button class="primary full auth-submit">${register ? "Create free account" : forgot ? "Send reset link" : "Sign in"} →</button>${forgot ? "" : `<div class="divider"><i></i><span>OR</span><i></i></div><button type="button" class="google-btn">G&nbsp;&nbsp; Continue with Google</button>`}<div class="auth-switch">${register ? `Already have an account? <button type="button" data-go="login">Sign in</button>` : forgot ? `<button type="button" data-go="login">← Back to sign in</button>` : `New to FrameFlow? <button type="button" data-go="register">Create account</button> · <button type="button" data-go="forgot">Forgot password?</button>`}</div></form></div></div>`;
  }
  document.querySelectorAll("[data-auth-shell]").forEach((node) => { node.outerHTML = authView(node.dataset.authShell); });

  function marketingHead(active) {
    return `<header class="site-head wide"><a class="brand" data-go="home"><span class="brand-mark">ϟ</span>FrameFlow</a><nav><button data-go="templates">Templates</button><button data-go="ai-image">AI Studio</button><button data-go="pricing" class="${active === "pricing" ? "active" : ""}">Pricing</button><button data-go="plugin" class="${active === "plugin" ? "active" : ""}">Plugin</button></nav><div class="head-actions"><button class="text-btn" data-go="login">Sign in</button><button class="primary" data-go="register">Start for free</button></div></header>`;
  }
  document.querySelectorAll("[data-marketing-head]").forEach((node) => { node.outerHTML = marketingHead(node.dataset.marketingHead); });
  // Footer ustunlari: Product / Categories / Plugins / Legal.
  const footer = `<footer class="site-footer"><div><a class="brand" data-go="home" href="#home"><span class="brand-mark">ϟ</span>FrameFlow</a><p>Templates and an AI studio for motion designers and video creators.</p><small>support@getframeflow.app<br>All plans include a 14-day money-back guarantee.</small></div><div><b>PRODUCT</b><a data-go="templates" href="#templates">Templates</a><a data-go="ai-image" href="#ai-image">AI Studio</a><a data-go="plugin" href="#plugin">Plugin</a><a data-go="pricing" href="#pricing">Pricing</a></div><div><b>CATEGORIES</b><a data-go="templates" href="#templates">Video Templates</a><a data-go="templates" href="#templates">Lower Thirds</a><a data-go="templates" href="#templates">Transitions</a><a data-go="templates" href="#templates">LUT &amp; Presets</a><a data-go="ai-audio" href="#ai-audio">SFX</a></div><div><b>PLUGINS</b><a data-go="plugin" href="#plugin">After Effects</a><a data-go="plugin" href="#plugin">Premiere · planned</a><a data-go="plugin" href="#plugin">DaVinci · planned</a></div><div><b>LEGAL</b><a data-go="help" href="#help">Help & FAQ</a><a data-go="legal-terms" href="#legal-terms">Terms</a><a data-go="legal-privacy" href="#legal-privacy">Privacy</a><a data-go="legal-refund" href="#legal-refund">Refunds</a><a data-go="legal-dmca" href="#legal-dmca">DMCA</a></div><div class="footer-cta"><span>© 2026 FRAMEFLOW</span><button class="primary" data-go="register">Start creating →</button></div></footer>`;
  document.querySelectorAll("[data-marketing-footer]").forEach((node) => { node.outerHTML = footer; });
  document.querySelectorAll("[data-pricing-grid]").forEach((node) => {
    node.outerHTML = `<div class="pricing-grid">${plans.map((p) => `<article class="price-card ${p.popular ? "featured" : ""}">${p.popular ? `<span class="popular-label">MOST POPULAR</span>` : ""}<span class="kicker">${p.name.toUpperCase()}</span><h3>${p.sub}</h3><div class="price">$${p.price}<small>/mo</small></div><small>${p.credits}</small><ul>${p.features.map((f) => `<li>${f}</li>`).join("")}</ul><button class="${p.popular ? "primary" : "secondary"}">${p.cta} →</button></article>`).join("")}</div>`;
  });

  const legalDocs = {
    terms: { title: "Terms of Service", updated: "Last updated: July 8, 2026", intro: "Welcome to FrameFlow, available at getframeflow.app. By creating an account or using the Service, you agree to these Terms.", sections: [
      ["1. The Service", "<p>FrameFlow provides video templates, an After Effects plugin with additional integrations planned, and credit-based AI generation tools for image, video, voice and sound effects.</p>"],
      ["2. Accounts", "<p>You must provide a valid email address and verify it. You are responsible for your credentials. Sharing an account beyond the limits of its plan is prohibited.</p>"],
      ["3. Subscriptions and payments", "<p>Pro and Studio payments are handled by Lemon Squeezy as Merchant of Record. It processes card details and applicable taxes; FrameFlow does not store card details. Subscriptions renew until cancelled, with access continuing through the paid period.</p>"],
      ["4. Credits", "<p>AI generations consume credits. Monthly plan credits reset and do not roll over. One-time pack credits are added separately and are preserved at the monthly reset.</p>"],
      ["5. Content and license", "<ul><li>Active-plan templates may be used in personal and commercial video projects.</li><li>Eligible AI outputs belong to you, subject to third-party model-provider terms.</li><li>Reselling or redistributing templates or generated materials as a competing product is prohibited.</li></ul>"],
      ["6. Contributors", "<p>Contributors apply for access, are reviewed, and grant FrameFlow a license to distribute approved templates. Payout terms are agreed separately.</p>"],
      ["7. Acceptable use", "<p>Illegal, infringing or harmful content, service disruption, plan-limit circumvention, sexualization of minors and non-consensual real-person deepfakes are prohibited and may be blocked.</p>"],
      ["8. Suspension and termination", "<p>FrameFlow may suspend or terminate accounts that violate these Terms. You may delete your account from Account settings.</p>"],
      ["9. Warranty and limitation of liability", "<p>The Service is provided “as is”. To the maximum extent permitted by law, liability is limited to the amount paid in the 12 months preceding a claim.</p>"],
      ["10. Changes", "<p>Material changes may be announced by email or in the app. Continued use constitutes acceptance.</p>"],
      ["Contact", "<p>Questions about these Terms: support@getframeflow.app.</p>"],
    ] },
    privacy: { title: "Privacy Policy", updated: "Last updated: July 8, 2026", intro: "This policy explains the account, usage and creative-workflow data FrameFlow processes to operate the Service.", sections: [
      ["1. What we collect", "<ul><li>Account data: email, name and password hash.</li><li>Usage data: downloads, imports, generation history and credit balance.</li><li>Content you provide: prompts, references and contributor uploads.</li><li>Payment data is processed by Lemon Squeezy; FrameFlow does not store card details.</li></ul>"],
      ["2. How we use it", "<p>To authenticate accounts, deliver downloads and AI generations, send transactional email, prevent abuse and improve the product. FrameFlow does not sell personal data.</p>"],
      ["3. Content moderation", "<p>Prompts, references and outputs may pass through automated moderation. Strictly prohibited content, including sexualization of minors and non-consensual deepfakes, is blocked and logged for review.</p>"],
      ["4. Processors", "<p>Processors include Lemon Squeezy, Google Cloud, Cloudflare, Resend, and enabled AI providers such as Google Vertex AI, BytePlus / ModelArk, fal.ai and ElevenLabs. A moderation provider may also be used when configured.</p>"],
      ["5. Retention", "<p>Account data is kept while the account exists. Self-service deletion anonymizes personal data and revokes access; backups are purged within 30 days. Financial records may be retained in anonymized form where law requires.</p>"],
      ["6. Cookies and storage", "<p>FrameFlow uses a session token and localStorage for settings. There are no third-party advertising trackers.</p>"],
      ["7. Your rights", "<p>You can export data as JSON and delete your account in Account settings. Access and correction requests can be sent to support@getframeflow.app.</p>"],
    ] },
    refund: { title: "Refund Policy", updated: "Last updated: July 8, 2026", intro: "Payments and applicable taxes are handled by Lemon Squeezy as Merchant of Record. This policy applies together with Lemon Squeezy’s buyer terms.", sections: [
      ["Subscriptions (Pro / Studio)", "<ul><li>A first subscription purchase may be refunded within 14 days if a substantial portion of included credits has not been used.</li><li>A renewal may be refunded within 14 days when the new period’s credits have not been used.</li><li>Cancelling stops future charges; access and remaining credits continue through the paid period.</li></ul>"],
      ["Credit packs", "<p>A one-time credit pack is fully refundable within 14 days only when none of its credits have been used. Once pack credits are spent, compute costs have been incurred and the pack becomes non-refundable.</p>"],
      ["How to request a refund", "<p>Email support@getframeflow.app from the account email with the order number. Approved refunds return to the original payment method, typically within 5–10 business days.</p>"],
    ] },
    dmca: { title: "Copyright / DMCA Policy", updated: "Last updated: July 8, 2026", intro: "FrameFlow respects third-party copyright and removes infringing catalog content in response to valid claims.", sections: [
      ["1. Designated agent", "<p>Send copyright claims to dmca@getframeflow.app or use the form below.</p>"],
      ["2. What a notice must include", "<p>Identify the protected work and disputed FrameFlow material, provide contact details, confirm a good-faith belief that the use is unauthorized, and confirm the notice is accurate and submitted by the rights holder or representative.</p>"],
      ["3. What we do", "<p>A valid notice removes the template from catalog and downloads and notifies the uploader. Repeat infringers may be terminated.</p>"],
      ["4. Counter-notice", "<p>If material was removed in error, email dmca@getframeflow.app with the material and a good-faith statement supporting reinstatement.</p>"],
      ["5. Report an infringement", "<p>Complete the form below. False claims may lead to liability.</p>"],
    ] },
  };
  function legalView(key) {
    const d = legalDocs[key];
    const form = key === "dmca" ? `<form class="dmca-form" onsubmit="return false"><div class="field"><label>YOUR EMAIL *<input type="email" placeholder="you@example.com"></label></div><div class="field"><label>NAME<input placeholder="Your name"></label></div><div class="field"><label>WHO YOU ARE<select><option>Rights holder</option><option>Authorized representative</option></select></label></div><div class="field"><label>INFRINGING MATERIAL<input placeholder="Template URL or ID"></label></div><div class="field full-row"><label>DESCRIPTION OF THE WORK AND CLAIM *<textarea placeholder="Which work is used without permission and why…"></textarea></label></div><label class="dmca-check full-row"><input type="checkbox"><span>The information is accurate and I have a good-faith belief that the use is not authorized.</span></label><button class="primary" disabled>Submit notice</button></form>` : "";
    return `<div class="legal-layout">${marketingHead("")}<div class="legal-body"><aside class="legal-aside"><span>ON THIS PAGE</span><nav>${d.sections.map((s, i) => `<button data-legal-index="${i}" class="${i === 0 ? "active" : ""}">${s[0]}</button>`).join("")}</nav></aside><article class="legal-copy"><span class="kicker">LEGAL · FRAMEFLOW</span><h1>${d.title}</h1><p class="updated">${d.updated}</p><article><p>${d.intro}</p></article>${d.sections.map((s, i) => `<article data-legal-section="${i}"><h2>${s[0]}</h2><div class="legal-section-body">${s[1]}</div>${key === "dmca" && i === d.sections.length - 1 ? form : ""}</article>`).join("")}</article></div>${footer}</div>`;
  }
  document.querySelectorAll("[data-legal]").forEach((node) => { node.outerHTML = legalView(node.dataset.legal); });

  const modelList = document.getElementById("modelList");
  let lastGroup = "";
  activeModels.forEach((m) => {
    if (m.group !== lastGroup) {
      modelList.insertAdjacentHTML("beforeend", `<div class="model-group-title">${m.group}</div>`);
      lastGroup = m.group;
    }
    const kind = m.name.includes("Chirp") ? "voice" : m.name.includes("SFX") ? "sfx" : m.group.startsWith("IMAGE") ? "image" : "video";
    modelList.insertAdjacentHTML("beforeend", `<div class="model-row" data-model-kind="${kind}"><span class="model-logo">${m.code}</span><div><b>${m.name}</b><small>${m.detail}</small></div><span class="model-cost">${m.cost}</span><button>Select</button></div>`);
  });

  const overlayIds = new Set(["ai-models", "ai-draw", "state-low-credits", "state-lightbox", "state-project-modal", "state-reference-library", "state-avatar-menu", "state-delete"]);
  const overlayOrigins = new Map();
  const overlayTriggers = new Map();

  function go(id, updateHash = true) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains("screen")) return;
    document.querySelectorAll(".screen").forEach((screen) => {
      const active = screen === target;
      screen.classList.toggle("active", active);
      screen.setAttribute("aria-hidden", String(!active));
      if ("inert" in screen) screen.inert = !active;
    });
    document.querySelectorAll(".nav-items [data-go]").forEach((button) => {
      const active = button.dataset.go === id;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    document.title = `FrameFlow · ${target.dataset.title || id} · Batch 6`;
    if (updateHash && location.hash !== `#${id}`) {
      try { history.pushState({ screen: id }, "", `#${id}`); }
      catch (_error) { location.hash = id; }
    }
    window.scrollTo(0, 0);
    if (updateHash) {
      const focusTarget = target.querySelector('[role="dialog"],[role="menu"]') || target;
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll("a[data-go]").forEach((link) => { if (!link.getAttribute("href")) link.setAttribute("href", `#${link.dataset.go}`); });
  document.querySelectorAll("[data-go]:not(button):not(a)").forEach((node) => {
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
  });
  document.addEventListener("click", (event) => {
    const goButton = event.target.closest("[data-go]");
    if (goButton) {
      event.preventDefault();
      const destination = goButton.dataset.go;
      const origin = document.querySelector(".screen.active")?.id;
      if (overlayIds.has(destination) && origin && origin !== destination && !goButton.closest(".mockbar")) {
        overlayOrigins.set(destination, origin);
        overlayTriggers.set(destination, goButton);
      }
      go(destination);
      return;
    }
    if (event.target.closest(".toast button")) { event.target.closest(".toast").hidden = true; return; }
    if (event.target.classList.contains("scrim")) { closeCurrentOverlay(); return; }
    if (document.querySelector(".screen.active")?.id === "state-avatar-menu" && event.target.closest(".avatar-demo") && !event.target.closest(".avatar-menu")) { closeCurrentOverlay(); return; }
    const toggle = event.target.closest(".filter-pills button,.category-row button,.history-filters button,.modal-tabs button,.segmented button");
    if (toggle) {
      toggle.parentElement.querySelectorAll("button").forEach((button) => {
        const active = button === toggle;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (toggle.closest(".model-modal")) filterModels();
      if (toggle.closest(".reference-modal")) filterReferences();
    }
    const selectorChoice = event.target.closest(".selector-panel button:not(.more),.voice-picker>button");
    if (selectorChoice) selectorChoice.parentElement.querySelectorAll(":scope>button:not(.more)").forEach((button) => {
      const selected = button === selectorChoice;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      const marker = button.querySelector(":scope>strong:last-child");
      if (selected && !marker) button.insertAdjacentHTML("beforeend", "<strong>✓</strong>");
      if (!selected && marker) marker.remove();
    });
    const referenceChoice = event.target.closest(".reference-grid>button");
    if (referenceChoice) {
      referenceChoice.parentElement.querySelectorAll(":scope>button").forEach((button) => {
        const selected = button === referenceChoice;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        const marker = button.querySelector(":scope>i");
        if (selected && !marker) button.insertAdjacentHTML("beforeend", "<i>✓</i>");
        if (!selected && marker) marker.remove();
      });
      const label = document.querySelector(".reference-modal footer span");
      label.textContent = `1 selected · ${referenceChoice.dataset.kind} reference`;
    }
    const modelSelect = event.target.closest(".model-row button");
    if (modelSelect) {
      modelList.querySelectorAll(".model-row").forEach((row) => { row.classList.remove("selected"); row.querySelector("button").textContent = "Select"; });
      modelSelect.closest(".model-row").classList.add("selected");
      modelSelect.textContent = "Selected";
    }
    const legalButton = event.target.closest("[data-legal-index]");
    if (legalButton) {
      const page = legalButton.closest(".legal-layout");
      page.querySelectorAll("[data-legal-index]").forEach((button) => button.classList.toggle("active", button === legalButton));
      page.querySelector(`[data-legal-section="${legalButton.dataset.legalIndex}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const close = event.target.closest("[data-close],.modal-x,.modal-head>button");
    if (close) closeCurrentOverlay();
  });
  document.addEventListener("keydown", (event) => {
    const route = event.target.closest?.("[data-go]:not(button):not(a)");
    if (route && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); go(route.dataset.go); }
    if (event.key === "Escape") closeCurrentOverlay();
    if (event.key === "Tab") {
      const overlay = document.querySelector('.screen.active [role="dialog"],.screen.active [role="menu"]');
      if (!overlay) return;
      const focusable = [...overlay.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); overlay.focus(); return; }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  function closeCurrentOverlay() {
    const active = document.querySelector(".screen.active")?.id;
    const back = { "ai-models": "ai-image", "ai-draw": "ai-image", "state-low-credits": "account-billing", "state-lightbox": "ai-history", "state-project-modal": "ai-history", "state-reference-library": "ai-image", "state-avatar-menu": "dashboard", "state-delete": "account-profile" };
    const destination = overlayOrigins.get(active) || back[active];
    if (!destination) return;
    const trigger = overlayTriggers.get(active);
    try { history.replaceState({ screen: destination }, "", `#${destination}`); }
    catch (_error) { location.hash = destination; }
    go(destination, false);
    overlayOrigins.delete(active);
    overlayTriggers.delete(active);
    if (trigger?.isConnected) trigger.focus();
    else {
      const target = document.getElementById(destination);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }
  const syncFromLocation = () => {
    const next = location.hash.slice(1);
    const target = document.getElementById(next);
    go(target?.classList.contains("screen") ? next : "home", false);
  };
  syncFromLocation();
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("popstate", syncFromLocation);

  const themes = ["noir", "neon", "cold"];
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (_error) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_error) { /* file:// privacy mode */ } },
  };
  function applyTheme(theme, persist = true) {
    const chosen = themes.includes(theme) ? theme : "noir";
    document.documentElement.dataset.theme = chosen;
    document.querySelectorAll("[data-theme-pick]").forEach((button) => {
      const active = button.dataset.themePick === chosen;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (persist) storage.set("ff-batch6-theme", chosen);
  }
  document.querySelectorAll("[data-theme-pick]").forEach((button) => button.addEventListener("click", () => applyTheme(button.dataset.themePick)));
  applyTheme(storage.get("ff-batch6-theme") || "noir", false);

  const mockbar = document.querySelector(".mockbar");
  const mockbarOpen = document.querySelector(".mockbar-open");
  function setMockbar(open) {
    mockbar.classList.toggle("is-closed", !open);
    mockbar.setAttribute("aria-hidden", String(!open));
    if ("inert" in mockbar) mockbar.inert = !open;
    mockbarOpen.setAttribute("aria-expanded", String(open));
  }
  document.querySelector(".mockbar__collapse").addEventListener("click", () => setMockbar(false));
  mockbarOpen.addEventListener("click", () => setMockbar(true));
  const compactNavigator = window.matchMedia("(max-width:1293px)");
  setMockbar(!compactNavigator.matches);
  compactNavigator.addEventListener?.("change", (event) => setMockbar(!event.matches));
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
      if (query) { group.classList.remove("is-collapsed"); group.firstElementChild.setAttribute("aria-expanded", "true"); }
    });
  });

  document.querySelectorAll("details").forEach((detail) => {
    const symbol = detail.querySelector("summary b");
    const update = () => { if (symbol) symbol.textContent = detail.open ? "−" : "+"; };
    detail.addEventListener("toggle", update);
    update();
  });
  const modelSearch = document.querySelector(".model-modal input");
  function filterModels() {
    const query = modelSearch?.value.toLowerCase().trim() || "";
    const tab = document.querySelector(".model-modal .modal-tabs button.active")?.textContent.trim().toLowerCase() || "all";
    let heading = null;
    let visibleInGroup = 0;
    [...modelList.children].forEach((child) => {
      if (child.classList.contains("model-group-title")) {
        if (heading) heading.hidden = visibleInGroup === 0;
        heading = child;
        visibleInGroup = 0;
        return;
      }
      const matchesTab = tab === "all" || child.dataset.modelKind === tab;
      const show = matchesTab && (!query || child.textContent.toLowerCase().includes(query));
      child.hidden = !show;
      if (show) visibleInGroup += 1;
    });
    if (heading) heading.hidden = visibleInGroup === 0;
  }
  modelSearch?.addEventListener("input", filterModels);
  const referenceSearch = document.querySelector(".reference-modal input");
  function filterReferences() {
    const query = referenceSearch?.value.toLowerCase().trim() || "";
    const tab = document.querySelector(".reference-modal .modal-tabs button.active")?.textContent.trim().toLowerCase() || "images";
    document.querySelectorAll(".reference-grid>button").forEach((button) => {
      const kind = `${button.dataset.kind || "image"}s`;
      button.hidden = kind !== tab || (!!query && !button.textContent.toLowerCase().includes(query));
    });
  }
  referenceSearch?.addEventListener("input", filterReferences);
  document.querySelectorAll(".modal-tabs").forEach((tabs) => tabs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("active")))));
  filterModels();
  filterReferences();
  const deleteInput = document.querySelector("#state-delete input");
  deleteInput?.addEventListener("input", () => { document.querySelector("#state-delete .danger-btn").disabled = deleteInput.value.trim().toUpperCase() !== "DELETE"; });
  const dmcaCheck = document.querySelector(".dmca-check input");
  dmcaCheck?.addEventListener("change", () => { document.querySelector(".dmca-form>.primary").disabled = !dmcaCheck.checked; });
  document.querySelectorAll(".count-stepper").forEach((stepper) => {
    const value = stepper.querySelector("b");
    const buttons = stepper.querySelectorAll("button");
    let count = Number.parseInt(value.textContent, 10) || 1;
    value.setAttribute("aria-live", "polite");
    const update = () => {
      value.textContent = `${count} / 4`;
      buttons[0].disabled = count === 1;
      buttons[1].disabled = count === 4;
    };
    buttons[0].addEventListener("click", () => { count = Math.max(1, count - 1); update(); });
    buttons[1].addEventListener("click", () => { count = Math.min(4, count + 1); update(); });
    update();
  });

  const screenCount = document.querySelectorAll(".screen").length;
  document.getElementById("coverageCount").textContent = `${screenCount} screens`;
})();
