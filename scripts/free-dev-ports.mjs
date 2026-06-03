#!/usr/bin/env node
/** 3000, 3001, 4000 — eski node jarayonlarini tozalash (PM2 dan oldin/keyin) */
import { execSync } from "child_process";

const PORTS = [4000, 3000, 3001];

for (const port of PORTS) {
  try {
    const out = execSync(`lsof -t -i :${port}`, { encoding: "utf8" }).trim();
    if (!out) continue;
    const pids = [...new Set(out.split("\n").filter(Boolean))];
    for (const pid of pids) {
      try {
        execSync(`kill ${pid}`, { stdio: "ignore" });
        console.log(`  port ${port}: PID ${pid} to'xtatildi`);
      } catch {
        /* */
      }
    }
  } catch {
    /* port bo'sh */
  }
}
