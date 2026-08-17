(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const media = {
    portrait: "https://cdn.getframeflow.app/templates/cmsf2sgt3004es6019j8ld7wu/thumb.jpg?v=1786288579598",
    eye: "https://cdn.getframeflow.app/templates/cmsfnjmvw004ws601q3eqw3ny/thumb.jpg?v=1786288579562",
    foil: "https://cdn.getframeflow.app/templates/cmrl3rf1r0018s601f0vtozng/thumb.jpg?v=1786289058020",
    motion: "https://cdn.getframeflow.app/templates/cmrl3pqpu0019s601f0vtozng/thumb.jpg?v=1786285457707"
  };

  const tools = [
    { id: "creative-assistant", name: "Creative Assistant", desc: "Chat to create and refine", icon: "FF", mode: "image", section: "featured", color: "#c9ff19", isNew: true },
    { id: "draw-edit", name: "Draw to Edit", desc: "Edit a video frame by frame", icon: "〰", mode: "video", section: "featured", color: "#c9ff19" },
    { id: "edit-video", name: "Edit Video", desc: "Clean, reframe and transform", icon: "✣", mode: "video", section: "featured", color: "#80e5ff" },
    { id: "reframe", name: "Reframe", desc: "Change video aspect intelligently", icon: "□", mode: "video", section: "featured", color: "#ffd26f" },
    { id: "upscale", name: "Upscale", desc: "Boost image and video quality", icon: "◐", mode: "image", section: "featured", color: "#bd8cff" },
    { id: "bridge", name: "Adobe Bridge", desc: "Send media between Adobe apps", icon: "↔", mode: "image", section: "new", color: "#ff9973", isNew: true },
    { id: "video-gen", name: "Video Generator", desc: "Create cinematic video", icon: "▣", mode: "video", section: "new", color: "#7ec7ff" },
    { id: "audio-gen", name: "Audio Generator", desc: "Create voice and sound", icon: "♫", mode: "voice", section: "new", color: "#ffce64", isNew: true },
    { id: "generative-fill", name: "Generative Fill", desc: "Replace and extend any frame", icon: "✺", mode: "image", section: "new", color: "#c9ff19", isNew: true },
    { id: "remove-bg", name: "Remove Background", desc: "Isolate subjects cleanly", icon: "◩", mode: "image", section: "enhance", color: "#8ef0c2" },
    { id: "restore", name: "Restore Detail", desc: "Repair noise and compression", icon: "◇", mode: "image", section: "enhance", color: "#e2a8ff" },
    { id: "relight", name: "Change Lighting", desc: "Relight any scene", icon: "✦", mode: "image", section: "scene", color: "#ffe568" },
    { id: "weather", name: "Change Weather", desc: "Transform the atmosphere", icon: "▧", mode: "video", section: "scene", color: "#72cfff" },
    { id: "time-day", name: "Time of Day", desc: "Shift light from dawn to night", icon: "◕", mode: "image", section: "scene", color: "#ffb36d" },
    { id: "motion-control", name: "Motion Control", desc: "Direct camera and subject motion", icon: "⇄", mode: "video", section: "scene", color: "#c9ff19" },
    { id: "voice", name: "Voiceover", desc: "Natural multilingual narration", icon: "≋", mode: "voice", section: "audio", color: "#c9ff19" },
    { id: "sfx", name: "Sound FX", desc: "Generate production-ready effects", icon: "⌁", mode: "sfx", section: "audio", color: "#ff8fa3" },
    { id: "music", name: "Music Bed", desc: "Create an edit-ready music bed", icon: "♬", mode: "sfx", section: "audio", color: "#bca3ff" },
    { id: "audio-cleanup", name: "Audio Cleanup", desc: "Remove noise and isolate dialogue", icon: "◒", mode: "voice", section: "audio", color: "#79e5c0" },
    { id: "image-gen", name: "Image Generator", desc: "Create and edit with references", icon: "▦", mode: "image", section: "create", color: "#c9ff19" },
    { id: "video-create", name: "Video Creator", desc: "Prompt, reference and animate", icon: "▶", mode: "video", section: "create", color: "#7fd6ff" },
    { id: "plugin-import", name: "Project Import", desc: "Import directly at the playhead", icon: "↓", mode: "image", section: "apps", color: "#ffca72" },
    { id: "render-queue", name: "Render Queue", desc: "Send finished media to Media Encoder", icon: "⇥", mode: "video", section: "apps", color: "#79bfff" }
  ];

  const sectionLabels = {
    featured: "Creative tools",
    new: "What's new",
    enhance: "Enhance",
    scene: "Scene",
    audio: "Audio",
    create: "Create",
    apps: "Apps"
  };
  const essentialToolIds = ["creative-assistant", "image-gen", "video-gen", "edit-video", "reframe"];

  const models = [
    { id: "nano-2", name: "Nano Banana 2", provider: "FrameFlow Image", modes: ["image"], cost: 8, tag: "FF" },
    { id: "flux-pro", name: "Flux Pro Ultra", provider: "Black Forest Labs", modes: ["image"], cost: 12, tag: "FX" },
    { id: "veo-lite", name: "Veo 3.1 Lite", provider: "Google Cloud", modes: ["video"], cost: 32, tag: "V3" },
    { id: "veo-fast", name: "Veo 3.1 Fast", provider: "Google Cloud", modes: ["video"], cost: 48, tag: "VF" },
    { id: "voice-multi", name: "Studio Voice Multilingual", provider: "ElevenLabs", modes: ["voice"], cost: 5, tag: "VO" },
    { id: "sound-fx", name: "Sound FX Studio", provider: "ElevenLabs", modes: ["sfx"], cost: 4, tag: "SX" }
  ];

  const assets = [
    { id: "a1", title: "Editorial Portrait Kit", type: "people", label: "PORTRAIT", desc: "Natural portrait references for commercial edits.", image: media.portrait },
    { id: "a2", title: "Eye Transformation", type: "motion", label: "MOTION", desc: "Macro transformation sequence with controlled detail.", image: media.eye },
    { id: "a3", title: "Crumpled Black Foil", type: "overlay", label: "OVERLAY", desc: "High-resolution foil texture and displacement map.", image: media.foil },
    { id: "a4", title: "Abstract Light Trails", type: "motion", label: "MOTION", desc: "Fast monochrome light trails for transitions.", image: media.motion },
    { id: "a5", title: "Cinematic Impact", type: "audio", label: "AUDIO", desc: "Layered cinematic hit with clean tail.", image: null },
    { id: "a6", title: "Neon Portrait Grade", type: "people", label: "LUT", desc: "Deep shadows and balanced neon skin tones.", image: media.portrait },
    { id: "a7", title: "Liquid Metal Overlay", type: "overlay", label: "OVERLAY", desc: "Polished liquid metal loop for title design.", image: media.foil },
    { id: "a8", title: "Digital Sweep", type: "audio", label: "SFX", desc: "Short interface sweep for transitions.", image: null }
  ];

  const state = {
    route: "home",
    toolFilter: "all",
    toolQuery: "",
    favorites: new Set(["creative-assistant", "edit-video", "reframe"]),
    quickMode: "image",
    mode: "image",
    modelId: "nano-2",
    ratio: "16:9",
    quality: "2K",
    credits: 665,
    browseFilter: "all",
    browseQuery: "",
    activeAsset: null,
    generationCount: 0,
    showcaseIndex: 0,
    objectUrl: null
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function setRoute(route) {
    const next = $(`#route-${route}`) ? route : "home";
    state.route = next;
    $$(".route").forEach((element) => element.classList.toggle("active", element.id === `route-${next}`));
    $$(".nav-item").forEach((element) => element.classList.toggle("active", element.dataset.route === next));
    $("#workMenu").hidden = true;
    $("#workMenuButton").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.title = `FrameFlow — ${next[0].toUpperCase()}${next.slice(1)} Mockup`;
  }

  function renderTools() {
    const visible = essentialToolIds.map((id) => tools.find((tool) => tool.id === id)).filter(Boolean);
    $("#toolSections").innerHTML = `<section class="tool-section essential-tools"><div class="tool-grid">${visible.map(toolCard).join("")}</div></section>`;
  }

  function renderAllTools(query = "") {
    const normalized = query.trim().toLowerCase();
    const visible = tools.filter((tool) => !normalized || `${tool.name} ${tool.desc} ${sectionLabels[tool.section]}`.toLowerCase().includes(normalized));
    $("#allToolsList").innerHTML = visible.map((tool) => `<button class="catalog-tool" type="button" data-tool="${tool.id}"><span style="--catalog-color:${tool.color}">${tool.icon}</span><div><b>${tool.name}</b><small>${tool.desc}</small></div><em>${sectionLabels[tool.section]}</em><i>↗</i></button>`).join("") || '<div class="tool-empty">No matching tools.</div>';
  }

  function toolCard(tool) {
    const favorite = state.favorites.has(tool.id);
    return `<article class="tool-card" tabindex="0" role="button" data-tool="${tool.id}" style="--tool-color:${tool.color}">
      <span class="tool-icon">${tool.icon}</span>${tool.isNew ? '<span class="new-badge">NEW</span>' : ""}
      <button class="favorite${favorite ? " active" : ""}" type="button" data-favorite="${tool.id}" aria-label="${favorite ? "Remove from" : "Add to"} favorites">${favorite ? "♥" : "♡"}</button>
      <strong>${tool.name}</strong><small>${tool.desc}</small>
    </article>`;
  }

  function chooseTool(toolId) {
    const tool = tools.find((item) => item.id === toolId);
    if (!tool) return;
    setMode(tool.mode);
    $("#createTitle").textContent = tool.name;
    $("#createSubtitle").textContent = tool.desc + ". Add a prompt, references and output settings.";
    $$('.modal-layer:not([hidden])').forEach(closeModal);
    setRoute("create");
    setTimeout(() => $("#promptInput").focus({ preventScroll: true }), 180);
  }

  function setQuickMode(mode) {
    state.quickMode = ["image", "video", "voice", "sfx"].includes(mode) ? mode : "image";
    $$("#quickModes button").forEach((button) => button.classList.toggle("active", button.dataset.quickMode === state.quickMode));
  }

  function startQuickSession() {
    const prompt = $("#quickPrompt").value.trim();
    setMode(state.quickMode);
    $("#createTitle").textContent = "FrameFlow Auto";
    $("#createSubtitle").textContent = "Model and output settings are matched to your creative direction.";
    $("#promptInput").value = prompt;
    updateCreateControls();
    setRoute("create");
    setTimeout(() => $("#promptInput").focus({ preventScroll: true }), 100);
  }

  let showcaseTimer;
  function setShowcase(index) {
    const slides = $$(".showcase-slide");
    if (!slides.length) return;
    state.showcaseIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => slide.classList.toggle("active", position === state.showcaseIndex));
    $$("[data-showcase-go]").forEach((button, position) => button.classList.toggle("active", position === state.showcaseIndex));
  }

  function restartShowcase() {
    clearInterval(showcaseTimer);
    showcaseTimer = setInterval(() => setShowcase(state.showcaseIndex + 1), 4200);
  }

  function availableModels() {
    return models.filter((model) => model.modes.includes(state.mode));
  }

  function selectedModel() {
    return models.find((model) => model.id === state.modelId) || availableModels()[0];
  }

  function setMode(mode) {
    state.mode = ["image", "video", "voice", "sfx"].includes(mode) ? mode : "image";
    const current = selectedModel();
    if (!current || !current.modes.includes(state.mode)) state.modelId = availableModels()[0].id;
    const labels = { image: "Image", video: "Video", voice: "Voice", sfx: "Sound FX" };
    $$("#modeTabs button").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
    $("#modeLabel").textContent = labels[state.mode];
    updateCreateControls();
  }

  function updateCreateControls() {
    const model = selectedModel();
    $("#modelLabel").textContent = model.name;
    $("#costLabel").textContent = model.cost;
    $("#settingsLabel").textContent = `${state.ratio} · ${state.mode === "video" ? "8s" : state.quality}`;
    const prompt = $("#promptInput").value.trim();
    $("#composerStatus").textContent = prompt ? "Ready" : "Write a prompt to begin";
    $("#generateButton").disabled = !prompt;
  }

  function renderModels(query = "") {
    const normalized = query.trim().toLowerCase();
    const list = availableModels().filter((model) => `${model.name} ${model.provider}`.toLowerCase().includes(normalized));
    $("#modelList").innerHTML = list.map((model) => `<button class="model-option${model.id === state.modelId ? " selected" : ""}" type="button" data-model="${model.id}"><span>${model.tag}</span><div><strong>${model.name}</strong><small>${model.provider}</small></div><b>✦ ${model.cost}</b></button>`).join("") || '<div class="tool-empty">No matching models.</div>';
  }

  function renderAssets() {
    const query = state.browseQuery.trim().toLowerCase();
    const list = assets.filter((asset) => (state.browseFilter === "all" || asset.type === state.browseFilter) && (!query || `${asset.title} ${asset.desc} ${asset.type}`.toLowerCase().includes(query)));
    $("#assetGrid").innerHTML = list.map(assetCard).join("") || '<div class="tool-empty">No matching assets. Try a broader search.</div>';
  }

  function assetCard(asset) {
    const art = asset.image ? `<img src="${asset.image}" alt="${escapeHtml(asset.title)}">` : '<div class="audio-art">▂▅▇▃▆</div>';
    return `<button class="asset-card" type="button" data-asset="${asset.id}"><div class="asset-media">${art}<span>${asset.label}</span></div><div><b>${asset.title}</b><small>${asset.desc}</small></div></button>`;
  }

  function renderWorkspace() {
    $("#libraryGrid").innerHTML = assets.slice(0, 6).map(assetCard).join("");
    const activity = [
      ["✦", "Neon portrait generated", "Nano Banana 2 · 2K", "Just now"],
      ["↓", "Crumpled Black Foil imported", "Adobe After Effects", "18m"],
      ["▶", "Editorial motion completed", "Veo 3.1 Lite · 8s", "1h"],
      ["⌁", "Sound effect downloaded", "WAV · 48kHz", "Yesterday"]
    ];
    $("#activityList").innerHTML = activity.map((item) => `<article class="activity-item"><span>${item[0]}</span><div><b>${item[1]}</b><small>${item[2]}</small></div><small>${item[3]}</small></article>`).join("");
    const projects = [
      ["Brand Launch", "8 items · Updated today"],
      ["Summer Campaign", "12 items · Updated yesterday"],
      ["Product Film", "5 items · Updated Friday"],
      ["Social Cutdowns", "16 items · Updated last week"]
    ];
    $("#projectGrid").innerHTML = projects.map((project) => `<article class="project-card"><span>□</span><b>${project[0]}</b><small>${project[1]}</small></article>`).join("");
  }

  function openAsset(assetId) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    state.activeAsset = asset;
    $("#assetModalTitle").textContent = asset.title;
    $("#assetModalType").textContent = asset.label;
    $("#assetModalDescription").textContent = asset.desc;
    $("#assetModalMedia").innerHTML = asset.image ? `<img src="${asset.image}" alt="${escapeHtml(asset.title)}">` : '<div class="audio-art">▂▅▇▃▆</div>';
    openModal("assetModal");
  }

  function openModal(id) {
    const layer = $(`#${id}`);
    if (!layer) return;
    layer.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("button, input", layer)?.focus(), 0);
  }

  function closeModal(layer) {
    const element = typeof layer === "string" ? $(`#${layer}`) : layer;
    if (!element) return;
    element.hidden = true;
    if (!$$('.modal-layer:not([hidden])').length) document.body.style.overflow = "";
  }

  let toastTimer;
  function showToast(title, message) {
    clearTimeout(toastTimer);
    $("#toastTitle").textContent = title;
    $("#toastMessage").textContent = message;
    $("#toast").hidden = false;
    toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3600);
  }

  function enhancePrompt() {
    const input = $("#promptInput");
    const original = input.value.trim();
    if (!original) {
      input.value = "A cinematic product reveal with precise camera movement, realistic materials, controlled studio lighting and a polished editorial finish";
    } else if (!/cinematic|lighting|camera/i.test(original)) {
      input.value = `${original}. Cinematic composition, intentional camera language, natural lighting, detailed materials and a polished editorial finish.`;
    } else {
      input.value = `${original}. Preserve subject identity, coherent motion and physically believable detail.`;
    }
    updateCreateControls();
    showToast("Prompt enhanced", "Creative direction, composition and technical clarity were added.");
  }

  function generate() {
    const prompt = $("#promptInput").value.trim();
    if (!prompt) return;
    const model = selectedModel();
    if (state.credits < model.cost) {
      showToast("Not enough credits", "Choose a lower-cost model or add credits.");
      return;
    }
    const button = $("#generateButton");
    button.disabled = true;
    $("#composerStatus").textContent = "Generating · 18%";
    $("#createEmpty").hidden = true;
    const resultId = `mock-result-${Date.now()}`;
    $("#sessionResults").insertAdjacentHTML("afterbegin", `<article class="result-card generating" id="${resultId}"><span>Building your ${state.mode}…</span></article>`);
    let progress = 18;
    const ticker = setInterval(() => {
      progress = Math.min(92, progress + 17);
      $("#composerStatus").textContent = `Generating · ${progress}%`;
    }, 250);
    setTimeout(() => {
      clearInterval(ticker);
      state.credits -= model.cost;
      state.generationCount += 1;
      $("#creditCount").textContent = state.credits;
      const result = $(`#${resultId}`);
      if (result) {
        const image = state.mode === "video" ? media.eye : state.mode === "image" ? media.portrait : media.foil;
        result.classList.remove("generating");
        result.innerHTML = `<img src="${image}" alt="Generated mock result"><footer><span><b>${escapeHtml(prompt.slice(0, 34))}${prompt.length > 34 ? "…" : ""}</b><small>${model.name} · ${state.mode === "video" ? "8s" : state.quality}</small></span><button type="button" data-download-result aria-label="Download result">↓</button></footer>`;
      }
      $("#composerStatus").textContent = "Complete · ready to import";
      button.disabled = false;
      showToast("Generation complete", `Mock result created with ${model.name}.`);
    }, 1250);
  }

  function resetSession() {
    $("#promptInput").value = "";
    $("#sessionResults").innerHTML = "";
    $("#createEmpty").hidden = false;
    removeReference();
    updateCreateControls();
    showToast("New session", "The workspace is ready for a new idea.");
  }

  function removeReference() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
    $("#referenceInput").value = "";
    $("#referencePreview").hidden = true;
    $("#referenceThumb").innerHTML = "REF";
  }

  function previewReference(file) {
    if (!file) return;
    removeReference();
    state.objectUrl = URL.createObjectURL(file);
    $("#referenceName").textContent = file.name;
    const thumb = $("#referenceThumb");
    if (file.type.startsWith("image/")) thumb.innerHTML = `<img src="${state.objectUrl}" alt="Reference preview">`;
    else if (file.type.startsWith("video/")) thumb.innerHTML = `<video src="${state.objectUrl}" muted></video>`;
    else thumb.textContent = "AUDIO";
    $("#referencePreview").hidden = false;
    showToast("Reference added", `${file.name} is ready for this mock session.`);
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      setRoute(routeButton.dataset.route);
      return;
    }
    const favorite = event.target.closest("[data-favorite]");
    if (favorite) {
      event.stopPropagation();
      const id = favorite.dataset.favorite;
      state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
      renderTools();
      showToast("Favorites updated", "Your Home tools were updated.");
      return;
    }
    const tool = event.target.closest("[data-tool]");
    if (tool) chooseTool(tool.dataset.tool);
    const model = event.target.closest("[data-model]");
    if (model) {
      state.modelId = model.dataset.model;
      updateCreateControls();
      closeModal("modelModal");
      showToast("Model selected", selectedModel().name);
    }
    const asset = event.target.closest("[data-asset]");
    if (asset) openAsset(asset.dataset.asset);
    const scroll = event.target.closest("[data-scroll]");
    if (scroll) $(`#${scroll.dataset.scroll}`)?.scrollBy({ left: Number(scroll.dataset.dir) * 440, behavior: "smooth" });
    const suggestion = event.target.closest("[data-suggestion]");
    if (suggestion) {
      $("#promptInput").value = suggestion.dataset.suggestion;
      updateCreateControls();
      $("#promptInput").focus();
    }
    const quickSuggestion = event.target.closest("[data-quick-prompt]");
    if (quickSuggestion) {
      $("#quickPrompt").value = quickSuggestion.dataset.quickPrompt;
      $("#quickPrompt").focus();
    }
    const showcaseGo = event.target.closest("[data-showcase-go]");
    if (showcaseGo) {
      setShowcase(Number(showcaseGo.dataset.showcaseGo));
      restartShowcase();
    }
    const close = event.target.closest("[data-close-modal]");
    if (close) closeModal(close.closest(".modal-layer"));
    if (event.target.classList.contains("modal-layer")) closeModal(event.target);
    if (event.target.closest("[data-download-result]") || event.target.closest(".generation-card > button")) showToast("Download ready", "This prototype simulates the download action.");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = $('.modal-layer:not([hidden])');
      if (modal) closeModal(modal);
      $("#workMenu").hidden = true;
    }
    const tool = event.target.closest?.("[data-tool]");
    if (tool && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      chooseTool(tool.dataset.tool);
    }
  });

  $("#workMenuButton").addEventListener("click", () => {
    const menu = $("#workMenu");
    menu.hidden = !menu.hidden;
    $("#workMenuButton").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("#creditButton").addEventListener("click", () => openModal("accountModal"));
  $("#accountButton").addEventListener("click", () => openModal("accountModal"));
  $("#allToolsButton").addEventListener("click", () => { $("#allToolsSearch").value = ""; renderAllTools(); openModal("toolsModal"); });
  $("#allToolsSearch").addEventListener("input", (event) => renderAllTools(event.target.value));
  $("#quickModes").addEventListener("click", (event) => { const button = event.target.closest("[data-quick-mode]"); if (button) setQuickMode(button.dataset.quickMode); });
  $("#quickCreateButton").addEventListener("click", startQuickSession);
  $("#quickAutoButton").addEventListener("click", () => { setMode(state.quickMode); $("#modelSearch").value = ""; renderModels(); openModal("modelModal"); });
  $("#quickPrompt").addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") startQuickSession(); });
  $("#showcasePrev").addEventListener("click", () => { setShowcase(state.showcaseIndex - 1); restartShowcase(); });
  $("#showcaseNext").addEventListener("click", () => { setShowcase(state.showcaseIndex + 1); restartShowcase(); });
  $("#modeTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-mode]"); if (button) setMode(button.dataset.mode); });
  $("#modeButton").addEventListener("click", () => {
    const order = ["image", "video", "voice", "sfx"];
    setMode(order[(order.indexOf(state.mode) + 1) % order.length]);
  });
  $("#modelButton").addEventListener("click", () => { $("#modelSearch").value = ""; renderModels(); openModal("modelModal"); });
  $("#modelSearch").addEventListener("input", (event) => renderModels(event.target.value));
  $("#settingsButton").addEventListener("click", () => openModal("settingsModal"));
  $$(".choice-row").forEach((row) => row.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    $$('button', row).forEach((item) => item.classList.toggle("active", item === button));
  }));
  $("#applySettings").addEventListener("click", () => {
    state.ratio = $('.choice-row[data-setting="ratio"] .active').textContent;
    state.quality = $('.choice-row[data-setting="quality"] .active').textContent;
    updateCreateControls();
    closeModal("settingsModal");
    showToast("Settings applied", `${state.ratio} · ${state.mode === "video" ? "8s" : state.quality}`);
  });
  $("#promptInput").addEventListener("input", updateCreateControls);
  $("#enhanceButton").addEventListener("click", enhancePrompt);
  $("#generateButton").addEventListener("click", generate);
  $("#newSessionButton").addEventListener("click", resetSession);
  $("#referenceInput").addEventListener("change", (event) => previewReference(event.target.files[0]));
  $("#removeReference").addEventListener("click", removeReference);
  $("#browseFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-filter]");
    if (!button) return;
    state.browseFilter = button.dataset.assetFilter;
    $$("#browseFilters button").forEach((item) => item.classList.toggle("active", item === button));
    renderAssets();
  });
  $("#browseSearchForm").addEventListener("submit", (event) => { event.preventDefault(); state.browseQuery = $("#browseSearchInput").value; renderAssets(); });
  $("#browseSearchInput").addEventListener("input", (event) => { state.browseQuery = event.target.value; renderAssets(); });
  $("#importAssetButton").addEventListener("click", () => {
    const title = state.activeAsset?.title || "Asset";
    closeModal("assetModal");
    showToast("Sent to Adobe", `${title} was added to the active project (mock action).`);
  });
  $("#addProjectButton").addEventListener("click", () => showToast("Project created", "Untitled project was added to the mock workspace."));
  $("#toastClose").addEventListener("click", () => { $("#toast").hidden = true; });

  renderTools();
  renderAssets();
  renderWorkspace();
  updateCreateControls();
  restartShowcase();
})();
