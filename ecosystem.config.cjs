const path = require("path");

const root = __dirname;

/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: "assetflow-api",
    cwd: root,
    script: "npm",
    args: "run dev:api",
    interpreter: "none",
    autorestart: true,
    max_restarts: 20,
    restart_delay: 1500,
    watch: false,
    env: { FORCE_COLOR: "1" },
  },
  {
    name: "assetflow-web",
    cwd: root,
    script: "npm",
    args: "run dev:web",
    interpreter: "none",
    autorestart: true,
    max_restarts: 20,
    restart_delay: 1500,
    watch: false,
    env: { FORCE_COLOR: "1" },
  },
  {
    name: "assetflow-admin",
    cwd: root,
    script: "npm",
    args: "run dev:studio-admin",
    interpreter: "none",
    autorestart: true,
    max_restarts: 20,
    restart_delay: 1500,
    watch: false,
    env: { FORCE_COLOR: "1" },
  },
];

module.exports = { apps };
