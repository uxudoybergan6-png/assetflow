#!/usr/bin/env node
/** Package the invisible Premiere host companion as an installable CCX (ZIP). */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "companion");
const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
const outDir = path.resolve(root, "../../dist/uxp");
const out = path.join(outDir, `frameflow-premiere-host-v${manifest.version}.ccx`);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "ff-uxp-host-package-"));

try {
  for (const name of ["manifest.json", "index.html", "bridge.js"]) {
    fs.copyFileSync(path.join(source, name), path.join(stage, name));
  }
  fs.copyFileSync(path.join(root, "js", "log.js"), path.join(stage, "log.js"));
  fs.copyFileSync(path.join(root, "js", "ae-shim", "csinterface-shim.js"), path.join(stage, "host-dispatch.js"));
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(out, { force: true });
  const zip = spawnSync("zip", ["-X", "-q", out, "manifest.json", "index.html", "bridge.js", "log.js", "host-dispatch.js"], {
    cwd: stage,
    encoding: "utf8",
  });
  if (zip.status !== 0) throw new Error(zip.stderr || zip.stdout || "zip failed");
  const bytes = fs.readFileSync(out);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(`${out}.sha256`, `${sha}  ${path.basename(out)}\n`, "utf8");
  console.log(out);
  console.log(`SHA-256 ${sha}`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
