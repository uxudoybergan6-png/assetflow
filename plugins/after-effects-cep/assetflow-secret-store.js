/**
 * FrameFlow — sessiya tokeni uchun OS-darajali saqlash (#138 / PL-h)
 *
 * MUAMMO: token `assetflow-data/prefs.json` ichida OCHIQ matn edi. Fayl
 * kengaytma papkasida yotadi va odatiy huquqlar bilan yaratiladi — mashinadagi
 * har qanday jarayon (yoki boshqa foydalanuvchi) uni o'qib, hisobni to'liq
 * egallashi mumkin edi. Backup/sinxronizatsiya vositalari ham uni nusxalaydi.
 *
 * TUZATISH — platformaning O'Z sirlar omboriga yozamiz, native modulsiz:
 *   • macOS   → Keychain (`security` CLI; parol STDIN orqali, `ps` da ko'rinmaydi)
 *   • Windows → DPAPI (PowerShell `ConvertFrom-SecureString`; faqat SHU
 *               foydalanuvchi va SHU mashina ocha oladi), shifrlangan matn faylda
 *   • Boshqa  → 0600 huquqli fayl (Linux'da universal ombor yo'q — hech
 *               bo'lmasa boshqa foydalanuvchilardan yopiladi)
 *
 * Backend chaqiruvi qimmat (jarayon spawn) — shu bois qiymat XOTIRADA keshlanadi
 * va faqat o'zgarganda yoziladi. Har bir API so'rovida CLI chaqirilmaydi.
 *
 * Backend ishlamasa — `available()` false qaytadi va chaqiruvchi eski
 * (prefs.json) yo'liga tushadi: token yo'qolgandan ko'ra ochiq saqlangani afzal,
 * lekin bu holat konsolga bir marta ogohlantirish yozadi.
 */
const AssetFlowSecret = (() => {
  const SERVICE = "FrameFlow AE Plugin";
  const ACCOUNT = "session-token";

  let cache = null; // null = hali o'qilmagan, "" = yo'q
  let backend = null; // "keychain" | "dpapi" | "file" | "none"
  let warned = false;

  function isCep() {
    return typeof window !== "undefined" && typeof window.__adobe_cep__ !== "undefined";
  }

  function platform() {
    try {
      return process.platform;
    } catch {
      return "";
    }
  }

  /**
   * #139 (PL-i) — PLATFORMAGA MOS sozlamalar papkasi.
   *
   * Ilgari `assetflow-catalog.js` har platformada macOS yo'lini qattiq kodlagan
   * edi (`~/Library/Application Support/AssetFlow`) → Windows'da uy papkasida
   * begona "Library" daraxti, Linux'da ham noto'g'ri joy. Yagona manba shu
   * yerda: bu modul boshqa modullardan OLDIN yuklanadi, shu bois catalog ham
   * shu funksiyani ishlatadi.
   */
  function settingsDir() {
    const path = require("path");
    const os = require("os");
    const p = platform();
    if (p === "win32") {
      const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      return path.join(base, "AssetFlow");
    }
    if (p === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "AssetFlow");
    }
    const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    return path.join(base, "assetflow");
  }

  /** Eski (noto'g'ri) macOS-yo'li — mac bo'lmagan platformada migratsiya uchun */
  function legacySettingsDir() {
    const path = require("path");
    const os = require("os");
    return path.join(os.homedir(), "Library", "Application Support", "AssetFlow");
  }

  /** Shifrlangan/plain token fayli — platformaga mos sozlamalar papkasida */
  function tokenFilePath() {
    const path = require("path");
    const fs = require("fs");
    const dir = settingsDir();
    if (!dir) return "";
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, platform() === "win32" ? "session.dpapi" : "session.token");
  }

  function detectBackend() {
    if (backend) return backend;
    if (!isCep()) return (backend = "none");
    const p = platform();
    try {
      const child = require("child_process");
      if (p === "darwin") {
        // `security` har macOS'da bor — mavjudligini arzon tekshiramiz
        child.execFileSync("security", ["help"], { stdio: "ignore", timeout: 5000 });
        return (backend = "keychain");
      }
      if (p === "win32") {
        child.execFileSync("powershell", ["-NoProfile", "-Command", "exit 0"], {
          stdio: "ignore",
          timeout: 8000,
        });
        return (backend = "dpapi");
      }
    } catch {
      /* backend yo'q — faylga tushamiz */
    }
    return (backend = "file");
  }

  /* ---------- macOS Keychain ---------- */

  function keychainRead() {
    const child = require("child_process");
    try {
      const out = child.execFileSync(
        "security",
        ["find-generic-password", "-a", ACCOUNT, "-s", SERVICE, "-w"],
        { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }
      );
      return String(out || "").trim();
    } catch {
      return ""; // yozuv yo'q
    }
  }

  function keychainWrite(value) {
    const child = require("child_process");
    // Parol STDIN'dan o'qiladi (`-w` qiymatsiz) — argv'da ko'rinmaydi.
    child.execFileSync(
      "security",
      ["add-generic-password", "-U", "-a", ACCOUNT, "-s", SERVICE, "-w"],
      { input: value + "\n", timeout: 10000, stdio: ["pipe", "ignore", "ignore"] }
    );
  }

  function keychainClear() {
    const child = require("child_process");
    try {
      child.execFileSync("security", ["delete-generic-password", "-a", ACCOUNT, "-s", SERVICE], {
        stdio: "ignore",
        timeout: 8000,
      });
    } catch {
      /* yozuv yo'q edi */
    }
  }

  /* ---------- Windows DPAPI (foydalanuvchi doirasida) ---------- */

  function dpapiProtect(value) {
    const child = require("child_process");
    const out = child.execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$s=[Console]::In.ReadToEnd().TrimEnd(\"`r`n\"); " +
          "ConvertTo-SecureString -String $s -AsPlainText -Force | ConvertFrom-SecureString",
      ],
      { input: value, encoding: "utf8", timeout: 20000, stdio: ["pipe", "pipe", "ignore"] }
    );
    return String(out || "").trim();
  }

  function dpapiUnprotect(blob) {
    const child = require("child_process");
    const out = child.execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$e=[Console]::In.ReadToEnd().Trim(); $ss=ConvertTo-SecureString -String $e; " +
          "[Runtime.InteropServices.Marshal]::PtrToStringAuto(" +
          "[Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))",
      ],
      { input: blob, encoding: "utf8", timeout: 20000, stdio: ["pipe", "pipe", "ignore"] }
    );
    return String(out || "").trim();
  }

  /* ---------- Fayl (0600) ---------- */

  function fileRead() {
    const fs = require("fs");
    const p = tokenFilePath();
    if (!p || !fs.existsSync(p)) return "";
    return String(fs.readFileSync(p, "utf8") || "").trim();
  }

  function fileWrite(text) {
    const fs = require("fs");
    const p = tokenFilePath();
    if (!p) throw new Error("token file path unavailable");
    fs.writeFileSync(p, text, { encoding: "utf8", mode: 0o600 });
    try {
      fs.chmodSync(p, 0o600); // mavjud fayl uchun ham majburlaymiz
    } catch {
      /* Windows'da chmod ma'nosiz */
    }
  }

  function fileClear() {
    const fs = require("fs");
    const p = tokenFilePath();
    try {
      if (p && fs.existsSync(p)) fs.rmSync(p, { force: true });
    } catch {
      /* */
    }
  }

  /* ---------- Ommaviy API ---------- */

  function available() {
    return detectBackend() !== "none";
  }

  function warnOnce(e) {
    if (warned) return;
    warned = true;
    try {
      console.warn("[FrameFlow] secure token store unavailable — falling back to prefs.json", e);
    } catch {
      /* */
    }
  }

  /** Saqlangan tokenni qaytaradi ("" — yo'q). Birinchi chaqiruvda diskdan o'qiydi. */
  function get() {
    if (cache != null) return cache;
    cache = "";
    if (!available()) return cache;
    try {
      const b = detectBackend();
      if (b === "keychain") cache = keychainRead();
      else if (b === "dpapi") {
        const blob = fileRead();
        cache = blob ? dpapiUnprotect(blob) : "";
      } else cache = fileRead();
    } catch (e) {
      warnOnce(e);
      cache = "";
    }
    return cache;
  }

  /** Tokenni saqlaydi. Muvaffaqiyatda true — aks holda chaqiruvchi prefs'ga yozadi. */
  function set(value) {
    const v = String(value || "");
    if (!available()) return false;
    if (!v) return clear();
    try {
      const b = detectBackend();
      if (b === "keychain") keychainWrite(v);
      else if (b === "dpapi") fileWrite(dpapiProtect(v));
      else fileWrite(v);
      cache = v;
      return true;
    } catch (e) {
      warnOnce(e);
      return false;
    }
  }

  function clear() {
    cache = "";
    if (!available()) return false;
    try {
      const b = detectBackend();
      if (b === "keychain") keychainClear();
      else fileClear();
      return true;
    } catch (e) {
      warnOnce(e);
      return false;
    }
  }

  return {
    available,
    get,
    set,
    clear,
    backend: () => detectBackend(),
    settingsDir,
    legacySettingsDir,
  };
})();

if (typeof window !== "undefined") window.AssetFlowSecret = AssetFlowSecret;
