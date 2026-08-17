(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrameFlowCreateWorkspace = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var MODES = ["image", "video", "voice", "sfx"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeOptions(desc) {
    if (!desc || typeof desc !== "object") return [];
    return Array.isArray(desc.options) ? desc.options.slice() : [];
  }

  function modelDefaults(model) {
    model = model || {};
    var image = model.imgSettings || {};
    var video = model.videoSettings || {};
    var out = {};
    if (image.aspect) out.aspectRatio = image.aspect.def || normalizeOptions(image.aspect)[0];
    if (image.quality) out.quality = image.quality.def || normalizeOptions(image.quality)[0];
    if (Array.isArray(image.num) && image.num.length) out.count = image.num[0];
    if (video.aspect) out.aspectRatio = video.aspect.def || normalizeOptions(video.aspect)[0];
    if (video.resolution) out.resolution = video.resolution.def || normalizeOptions(video.resolution)[0];
    if (video.duration) out.duration = video.duration.def || normalizeOptions(video.duration)[0];
    if (video.audioLocked !== true && model.audioLocked !== true) {
      if (typeof video.audioDefault === "boolean") out.audio = video.audioDefault;
      else if (video.audio === true) out.audio = true;
    }
    if (video.bitrate) out.bitrateMode = video.bitrate.def || normalizeOptions(video.bitrate)[0];
    if (Array.isArray(model.voices) && model.voices.length) out.voice = model.voices[0].id;
    if (!video.duration && Array.isArray(model.durations) && model.durations.length) out.duration = model.durations[0];
    return out;
  }

  function settingOptions(model, key) {
    model = model || {};
    var image = model.imgSettings || {};
    var video = model.videoSettings || {};
    if (key === "aspectRatio") return normalizeOptions(image.aspect).concat(normalizeOptions(video.aspect));
    if (key === "quality") return normalizeOptions(image.quality);
    if (key === "count") return Array.isArray(image.num) ? image.num.slice() : [];
    if (key === "resolution") return normalizeOptions(video.resolution);
    if (key === "duration") {
      var values = normalizeOptions(video.duration);
      return values.length ? values : (Array.isArray(model.durations) ? model.durations.slice() : []);
    }
    if (key === "bitrateMode") return normalizeOptions(video.bitrate);
    if (key === "voice") return Array.isArray(model.voices) ? model.voices.map(function (v) { return v.id; }) : [];
    if (key === "audio") return video.audio === true && video.audioLocked !== true && model.audioLocked !== true ? [true, false] : [];
    return [];
  }

  function referenceLimits(model) {
    model = model || {};
    // API truth source `mediaRefs`; eski klient fixture'lari `mediaRefLimits` ishlatgan.
    var limits = model.mediaRefs || model.mediaRefLimits || {};
    var total = model.refKind === "frames" ? (model.endFrame ? 2 : 1) : Number(limits.total);
    if (!isFinite(total)) total = Number(model.maxRefs);
    if (!isFinite(total) && model.refKind === "image") total = 1;
    if (!isFinite(total)) total = 0;
    var kinds = [];
    if (model.refKind === "image" || model.refKind === "frames" || model.refMode === "required" || model.refMode === "image-edit") kinds.push("image");
    if (model.refKind === "media-refs") {
      ["image", "video", "audio"].forEach(function (kind) {
        if (Number(limits[kind]) > 0) kinds.push(kind);
      });
    }
    if (model.videoSettings && model.videoSettings.frames) kinds.push("image");
    return {
      total: Math.max(0, total),
      image: Math.max(0, Number(limits.image) || (model.refKind === "frames" ? total : (model.refKind === "image" ? total : 0))),
      video: Math.max(0, Number(limits.video) || 0),
      audio: Math.max(0, Number(limits.audio) || 0),
      kinds: kinds.filter(function (v, i, a) { return a.indexOf(v) === i; })
    };
  }

  function createController(options) {
    options = options || {};
    var state = {
      mode: MODES.indexOf(options.mode) >= 0 ? options.mode : "image",
      prompt: "",
      models: { image: [], video: [], voice: [], sfx: [] },
      modelId: null,
      settings: {},
      references: [],
      quote: { status: "idle", price: null, revision: -1, error: "" },
      revision: 0,
      submitting: false,
      sessionId: null
    };
    var privateQuote = null;
    var submitPromise = null;

    function currentModels() { return state.models[state.mode] || []; }
    function currentModel() {
      return currentModels().filter(function (m) { return String(m.id) === String(state.modelId); })[0] || null;
    }
    function invalidateQuote() {
      state.revision += 1;
      state.quote = { status: "idle", price: null, revision: -1, error: "" };
      privateQuote = null;
    }
    function selectModel(id) {
      var model = currentModels().filter(function (m) { return String(m.id) === String(id); })[0];
      if (!model) return false;
      state.modelId = model.id;
      var defaults = modelDefaults(model);
      Object.keys(state.settings).forEach(function (key) {
        var opts = settingOptions(model, key);
        if (opts.length && opts.some(function (v) { return String(v) === String(state.settings[key]); })) defaults[key] = state.settings[key];
      });
      state.settings = defaults;
      invalidateQuote();
      return true;
    }
    function setModels(mode, models) {
      if (MODES.indexOf(mode) < 0) return false;
      state.models[mode] = (Array.isArray(models) ? models : []).filter(function (m) {
        return m && m.id != null && m.disabled !== true && m.enabled !== false && m.available !== false;
      });
      if (mode === state.mode) {
        var keep = state.models[mode].some(function (m) { return String(m.id) === String(state.modelId); });
        if (!keep) {
          var selected = state.models[mode].filter(function (m) { return m.isDefault; })[0] || state.models[mode][0] || null;
          state.modelId = selected ? selected.id : null;
          state.settings = selected ? modelDefaults(selected) : {};
          invalidateQuote();
        }
      }
      return true;
    }
    function setMode(mode) {
      if (MODES.indexOf(mode) < 0 || mode === state.mode) return false;
      state.mode = mode;
      var models = currentModels();
      var selected = models.filter(function (m) { return m.isDefault; })[0] || models[0] || null;
      state.modelId = selected ? selected.id : null;
      state.settings = selected ? modelDefaults(selected) : {};
      invalidateQuote();
      return true;
    }
    function setPrompt(prompt) { state.prompt = String(prompt || ""); }
    function setSetting(key, value) {
      var opts = settingOptions(currentModel(), key);
      if (!opts.length || !opts.some(function (v) { return String(v) === String(value); })) return false;
      state.settings[key] = value;
      invalidateQuote();
      return true;
    }
    function addReference(ref) {
      if (!ref || !ref.id || !ref.kind) return { ok: false, reason: "invalid_reference" };
      if (state.references.some(function (r) { return r.id === ref.id; })) return { ok: false, reason: "duplicate_reference" };
      var cap = referenceLimits(currentModel());
      if (!cap.kinds.length || cap.kinds.indexOf(ref.kind) < 0) return { ok: false, reason: "unsupported_reference" };
      if (state.references.length >= cap.total) return { ok: false, reason: "reference_limit" };
      state.references.push(clone(ref));
      invalidateQuote();
      return { ok: true };
    }
    function removeReference(id) {
      var next = state.references.filter(function (r) { return r.id !== id; });
      if (next.length === state.references.length) return false;
      state.references = next;
      invalidateQuote();
      return true;
    }
    function referenceProjection() {
      var cap = referenceLimits(currentModel());
      var used = { image: 0, video: 0, audio: 0 }, total = 0;
      return state.references.map(function (ref) {
        var kindCap = Number(cap[ref.kind]) || 0;
        var active = cap.kinds.indexOf(ref.kind) >= 0 && used[ref.kind] < kindCap && total < cap.total;
        if (active) { used[ref.kind] += 1; total += 1; }
        return {
          id: ref.id,
          active: active,
          kind: ref.kind,
          title: ref.title || "Reference",
          url: ref.url || ref.srcUrl || null,
          role: ref.role || ref.slot || null,
          savedReferenceId: ref.savedReferenceId || ref.savedRefId || null
        };
      });
    }
    function validation() {
      var model = currentModel();
      if (!model) return { ok: false, reason: "model_unavailable" };
      if (state.prompt.trim().length < 2) return { ok: false, reason: "prompt_required" };
      var required = model.refMode === "required" || model.startFrameRequired === true;
      if (required && !referenceProjection().some(function (r) { return r.active; })) return { ok: false, reason: "reference_required" };
      var activeRefs = referenceProjection().filter(function (r) { return r.active; });
      if (activeRefs.some(function (r) { return r.kind === "audio"; }) &&
          !activeRefs.some(function (r) { return r.kind === "image" || r.kind === "video"; })) {
        return { ok: false, reason: "audio_reference_requires_visual" };
      }
      if (state.quote.status === "loading") return { ok: false, reason: "quote_loading" };
      if (state.quote.status !== "ready" || state.quote.revision !== state.revision || !privateQuote) return { ok: false, reason: "quote_required" };
      if (state.quote.expiresAt && Date.now() >= state.quote.expiresAt) return { ok: false, reason: "quote_expired" };
      return { ok: true, reason: "" };
    }
    function quoteParams() {
      var params = clone(state.settings) || {};
      var model = currentModel() || {};
      var active = referenceProjection().filter(function (r) { return r.active && r.url; });
      var images = active.filter(function (r) { return r.kind === "image"; });
      var videos = active.filter(function (r) { return r.kind === "video"; });
      var audios = active.filter(function (r) { return r.kind === "audio"; });
      if (state.mode === "image" && images.length) {
        params.referenceUrl = images[0].url;
        params.referenceUrls = images.map(function (r) { return r.url; });
      } else if (state.mode === "video" && model.refKind === "frames") {
        var start = images.filter(function (r) { return r.role === "start"; })[0] || images[0];
        var end = images.filter(function (r) { return r.role === "end"; })[0] || images[1];
        if (start) params.referenceUrl = start.url;
        if (start && end && model.endFrame) params.referenceEndUrl = end.url;
      } else if (state.mode === "video" && model.refKind === "media-refs") {
        var frameStart = images.filter(function (r) { return r.role === "start"; })[0];
        var frameEnd = images.filter(function (r) { return r.role === "end"; })[0];
        var mediaImages = images.filter(function (r) { return r.role !== "start" && r.role !== "end"; });
        if (frameStart) params.referenceUrl = frameStart.url;
        if (frameStart && frameEnd && model.endFrame) params.referenceEndUrl = frameEnd.url;
        if (mediaImages.length) params.imageUrls = mediaImages.map(function (r) { return r.url; });
        if (videos.length) params.videoUrls = videos.map(function (r) { return r.url; });
        if (audios.length) params.audioUrls = audios.map(function (r) { return r.url; });
      }
      var saved = active.map(function (r) { return r.savedReferenceId; }).filter(Boolean);
      if (saved.length) params.savedReferenceIds = saved;
      return params;
    }
    function requestQuote(fetchQuote) {
      if (typeof fetchQuote !== "function" || !currentModel()) return Promise.reject(new Error("model_unavailable"));
      var revision = state.revision;
      state.quote = { status: "loading", price: null, revision: revision, error: "" };
      return Promise.resolve(fetchQuote({ mode: state.mode, modelId: state.modelId, params: quoteParams() })).then(function (quote) {
        if (revision !== state.revision) return { stale: true };
        if (!quote || typeof quote.price !== "number" || !quote.signature) throw new Error("invalid_quote");
        privateQuote = quote;
        var expiresAt = quote.expiresAt ? Date.parse(quote.expiresAt) : (Number(quote.expiresAtMs) || null);
        if (!isFinite(expiresAt)) expiresAt = null;
        state.quote = { status: "ready", price: quote.price, revision: revision, error: "", expiresAt: expiresAt };
        return { stale: false, price: quote.price };
      }).catch(function (error) {
        if (revision === state.revision) {
          privateQuote = null;
          state.quote = { status: "failed", price: null, revision: revision, error: String(error && error.message || "quote_failed") };
        }
        throw error;
      });
    }
    function submit(dispatch) {
      if (submitPromise) return submitPromise;
      var check = validation();
      if (!check.ok) return Promise.reject(new Error(check.reason));
      if (typeof dispatch !== "function") return Promise.reject(new Error("missing_dispatch"));
      state.submitting = true;
      var payload = {
        mode: state.mode,
        prompt: state.prompt.trim(),
        modelId: state.modelId,
        params: clone(privateQuote.pricedParams || quoteParams()),
        references: referenceProjection().filter(function (r) { return r.active; }),
        quotedPrice: state.quote.price,
        costQuoteSignature: privateQuote.signature,
        quoteExpiresAt: state.quote.expiresAt || null,
        sessionId: state.sessionId
      };
      submitPromise = Promise.resolve().then(function () { return dispatch(clone(payload)); }).finally(function () {
        state.submitting = false;
        submitPromise = null;
      });
      return submitPromise;
    }
    function setSession(id) { state.sessionId = id || null; }
    function snapshot() {
      return {
        mode: state.mode,
        prompt: state.prompt,
        models: clone(currentModels()),
        model: clone(currentModel()),
        modelId: state.modelId,
        settings: clone(state.settings),
        references: referenceProjection(),
        quote: clone(state.quote),
        revision: state.revision,
        submitting: state.submitting,
        sessionId: state.sessionId,
        validation: validation()
      };
    }
    return {
      setModels: setModels,
      setMode: setMode,
      setPrompt: setPrompt,
      setSetting: setSetting,
      selectModel: selectModel,
      addReference: addReference,
      removeReference: removeReference,
      requestQuote: requestQuote,
      submit: submit,
      setSession: setSession,
      invalidateQuote: invalidateQuote,
      snapshot: snapshot
    };
  }

  return { MODES: MODES.slice(), createController: createController, modelDefaults: modelDefaults, settingOptions: settingOptions, referenceLimits: referenceLimits };
});
