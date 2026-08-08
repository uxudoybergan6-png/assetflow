import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SCRIPT_DIR, "../../..");
export const OUT_DIR = path.join(ROOT, "docs/vnext-baseline");

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const read = (file) => readFileSync(file, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const uniq = (items) => [...new Set(items)].sort();
const matches = (source, regex, pick = (match) => match[0]) =>
  [...source.matchAll(regex)].map(pick);

const PLUGIN_DIR = path.join(ROOT, "plugins/after-effects-cep");
const PANEL = path.join(PLUGIN_DIR, "AssetFlow_Plugin.html");
const ACCOUNT = path.join(PLUGIN_DIR, "assetflow-account.js");
const CATALOG = path.join(PLUGIN_DIR, "assetflow-catalog.js");
const CREATE = path.join(PLUGIN_DIR, "frameflow-create-workspace.js");
const AE_HOST = path.join(PLUGIN_DIR, "jsx/host.jsx");
const PR_HOST = path.join(PLUGIN_DIR, "jsx/host-premiere.jsx");
const MANIFEST = path.join(PLUGIN_DIR, "CSXS/manifest.xml");
const API_GEN = path.join(ROOT, "apps/api/src/routes/studio-gen.ts");
const API_PLUGIN = path.join(ROOT, "apps/api/src/routes/plugin.ts");
const WEB = path.join(ROOT, "packages/assetflow-studio/platform/index.html");

const panelAssets = [...read(PANEL).matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((file) => !/^(?:https?:|data:)/.test(file))
  .map((file) => path.join(PLUGIN_DIR, file))
  .filter((file) => existsSync(file));
const runtimeFiles = [...new Set([PANEL, ACCOUNT, CATALOG, CREATE, ...panelAssets])];

function sourceInfo(file) {
  const source = read(file);
  return {
    path: rel(file),
    bytes: Buffer.byteLength(source),
    lines: source.split(/\r?\n/).length,
    sha256: sha256(source),
    addEventListener: matches(source, /\baddEventListener\s*\(/g).length,
    setInterval: matches(source, /\bsetInterval\s*\(/g).length,
    setTimeout: matches(source, /\bsetTimeout\s*\(/g).length,
    localStorage: matches(source, /\blocalStorage\b/g).length,
    objectUrlCreate: matches(source, /\bURL\.createObjectURL\s*\(/g).length,
    objectUrlRevoke: matches(source, /\bURL\.revokeObjectURL\s*\(/g).length,
  };
}

function extractApiRoutes(file, routerName, prefix) {
  const source = read(file);
  const regex = new RegExp(`${routerName}\\.(get|post|patch|delete|put)\\(\\s*["']([^"']+)["']`, "g");
  return matches(source, regex, (match) => ({
    method: match[1].toUpperCase(),
    path: `${prefix}${match[2]}`,
  })).sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}

function extractLiteralStorageKeys(source) {
  return uniq(matches(
    source,
    /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*(["'])([^"']+)\1/g,
    (match) => match[2],
  ));
}

function inventory() {
  const panel = read(PANEL);
  const sources = runtimeFiles.map(sourceInfo);
  const totals = sources.reduce((out, item) => {
    for (const key of ["bytes", "lines", "addEventListener", "setInterval", "setTimeout", "localStorage", "objectUrlCreate", "objectUrlRevoke"]) {
      out[key] += item[key];
    }
    return out;
  }, { bytes: 0, lines: 0, addEventListener: 0, setInterval: 0, setTimeout: 0, localStorage: 0, objectUrlCreate: 0, objectUrlRevoke: 0 });
  const allRuntime = runtimeFiles.map(read).join("\n");
  return {
    schemaVersion: 1,
    product: "FrameFlow shared CEP",
    pluginVersion: matches(read(MANIFEST), /ExtensionBundleVersion="([^"]+)"/g, (match) => match[1])[0],
    hosts: matches(read(MANIFEST), /<Host Name="([^"]+)"/g, (match) => match[1]),
    sources,
    totals,
    views: uniq(matches(panel, /\bid="(v-[^"]+)"/g, (match) => match[1])),
    scriptOrder: matches(panel, /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (match) => match[1]),
    inlineScriptBlocks: matches(panel, /<script\b(?![^>]*\bsrc=)[^>]*>/g).length,
    inlineEventAttributes: matches(panel, /\son[a-z]+\s*=/gi).length,
    declaredFunctions: uniq(matches(allRuntime, /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, (match) => match[1])),
    literalStorageKeys: extractLiteralStorageKeys(allRuntime),
    apiLiteralPaths: uniq(matches(allRuntime, /["'](\/api\/[A-Za-z0-9_?&=/:.{}+-]+)["']/g, (match) => match[1])),
    knownLegacyOwners: {
      navigation: ["afNavTab", "axGo"],
      transport: ["studioGet", "studioPost", "studioPostForm", "AssetFlowAccount.request"],
      jobStore: "af_active_jobs",
      createFacade: "FrameFlowCreateWorkspace",
      demoHomeRegistry: "FHOME_DEMO_VIDEO_TEMPLATES",
    },
    v2EmbeddedDefaults: {
      shellV2: false,
      homeV2: false,
      createImageV2: false,
      createVideoV2: false,
      createAudioV2: false,
      toolsV2: false,
      workSurfacesV2: false,
      browseV2: false,
      accountV2: false,
      generationDomainV2: { image: false, video: false, audio: false, tools: false },
    },
  };
}

function contracts() {
  return {
    schemaVersion: 1,
    sources: [API_PLUGIN, API_GEN, ACCOUNT, CREATE, WEB].map(sourceInfo),
    routes: {
      plugin: extractApiRoutes(API_PLUGIN, "pluginRouter", "/api/plugin"),
      studio: extractApiRoutes(API_GEN, "studioGenRouter", "/api/studio"),
    },
    immutableInvariants: [
      "AE and Premiere share one auth/session token and one CEP UI/controller.",
      "Pre-auth device requests never send Authorization.",
      "Network, 429, 5xx and non-auth 403 errors do not clear the session.",
      "Access tokens, poll tokens, quote signatures and signed URLs never enter browser URLs or telemetry.",
      "Generation params equal the accepted quote pricedParams.",
      "A quote is bound to model, canonical params and reference manifest.",
      "Credit debit is atomic and an authoritative failure refunds at most once.",
      "Reference ownership, MIME, size, TTL, role and requiredness are server authoritative.",
      "Catalog import requires APPROVED, published and hasPack.",
    ],
    canonicalGenerationStates: [
      "draft", "validating", "quoting", "quote_ready", "submitting", "queued", "processing",
      "completed", "failed", "canceled", "refund_pending", "refunded",
    ],
    knownMigrationRisks: [
      "Create facade delegates to a legacy Generate button and can cause a replacement quote.",
      "Legacy generation engines and pollers have multiple owners.",
      "af_active_jobs is not account scoped.",
      "Legacy navigation has no single enter/leave/dispose lifecycle owner.",
    ],
  };
}

function hostMatrix() {
  return {
    schemaVersion: 1,
    sourceHashes: [AE_HOST, PR_HOST, MANIFEST].map(sourceInfo),
    sharedUi: rel(PANEL),
    bootstrap: "jsx/host-bootstrap.jsx selects the host adapter at runtime",
    capabilities: {
      AEFT: {
        nativeMogrtImport: false,
        projectTemplateImport: true,
        safeRemoveByStableId: true,
        projectReference: true,
        timelineReference: true,
        currentFrameReference: true,
        publisher: true,
        uxpFallback: false,
      },
      PPRO: {
        nativeMogrtImport: true,
        projectTemplateImport: "manual",
        safeRemoveByStableId: true,
        projectReference: true,
        timelineReference: true,
        currentFrameReference: "qe-fallback",
        publisher: false,
        uxpFallback: true,
      },
    },
    importDestinations: {
      image: ["Adobe Project", "Timeline when supported"],
      video: ["Adobe Project", "Timeline when supported"],
      audio: ["Adobe Project", "Timeline when supported"],
      template: ["host-specific project/template flow"],
    },
    releaseDecision: {
      currentFlavor: "dual-host",
      publicReadiness: "blocked",
      blocker: "Adobe-approved single-install/update/uninstall evidence for the hidden Premiere UXP companion is not complete.",
      failClosedAlternative: "Ship an AE-only public flavor with every PPRO claim and dependency removed.",
    },
  };
}

function cleanRoomBehavior() {
  return {
    schemaVersion: 1,
    benchmark: "Higgsfield CEP 1.0.46",
    evidenceBoundary: "Observable tasks and interaction states only; no source, class, copy, asset, endpoint, color palette or proprietary implementation is copied.",
    acceptedGenericPatterns: [
      "Continue/last generations with a New entry",
      "Category tabs and account-scoped pinned tools",
      "Responsive compact tool registry grid",
      "Contextual tool header with global navigation retained",
      "Image, Video and Audio family switcher",
      "Generation feed with a sticky capability-driven composer",
      "Accessible menu, dialog and popover behavior",
      "Explicit loading, disabled, retryable error and reduced-motion states",
      "Provider availability, version/update and host/workspace status",
    ],
    rejectedPatterns: [
      "Competitor source, sourcemap sourcesContent, class names, copy, assets, logos or endpoints",
      "Remote marketing or unrelated marketplace surfaces",
      "Placeholder routes and dead actions",
      "Hover-only critical actions",
      "User-independent global pin state",
      "One-second debug polling",
      "Removing all global navigation inside generation routes",
    ],
  };
}

function provenance() {
  return {
    schemaVersion: 1,
    allowedOrigins: ["existing FrameFlow", "FrameFlow product requirement", "generic observed behavior"],
    surfaces: {
      globalShell: "FrameFlow product requirement",
      homeContinueAndToolGrid: "generic observed behavior",
      canonicalCreateComposer: "existing FrameFlow",
      signedQuoteAndCreditFlow: "existing FrameFlow",
      sharedAePremiereAuth: "existing FrameFlow",
      activityAndWorkMenu: "FrameFlow product requirement",
      accountScopedPins: "FrameFlow product requirement",
      accessibleDialogsAndMenus: "generic observed behavior",
    },
    forbiddenProductionInputs: ["competitor source", "competitor sourcemap", "competitor assets", "competitor copy", "competitor endpoints"],
    visualBaselineRule: "Use original FrameFlow mockups and versioned screenshots, never competitor screenshots.",
  };
}

export function collectBaseline() {
  return {
    "runtime-inventory.json": inventory(),
    "contract-snapshot.json": contracts(),
    "host-capability-matrix.json": hostMatrix(),
    "clean-room-behavior.json": cleanRoomBehavior(),
    "provenance-manifest.json": provenance(),
  };
}

export function writeBaseline() {
  mkdirSync(OUT_DIR, { recursive: true });
  const baseline = collectBaseline();
  for (const [name, value] of Object.entries(baseline)) {
    writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  return Object.keys(baseline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes("--write")) {
    process.stdout.write(`${JSON.stringify(collectBaseline(), null, 2)}\n`);
  } else {
    const names = writeBaseline();
    console.log(`vNext Wave 0 baseline written: ${names.join(", ")}`);
  }
}
