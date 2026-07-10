/**
 * server.js — start the entire project with one command:
 *
 *   node server.js
 *
 *   Backend  → http://localhost:8080   (Express + Socket.IO)
 *   Frontend → http://localhost:5173   (React + Vite)
 *
 * Open http://localhost:5173 in your browser.
 * All /api/* requests are proxied from Vite to the backend automatically.
 */

'use strict';

const { spawn, execSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';

const tag = (label, color) => `${color}${BOLD}[${label}]${R} `;

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT    = __dirname;
const API_DIR = path.join(ROOT, 'artifacts', 'api-server');
const WEB_DIR = path.join(ROOT, 'artifacts', 'chat-app');

// ─── 1. Load .env from project root ──────────────────────────────────────────
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    });
  console.log(`${GREEN}✅ Loaded .env${R}`);
} else {
  console.warn(`${YELLOW}⚠️  No .env found. Copy .env.example → .env and fill in MONGO_URI + JWT_SECRET.${R}\n`);
}

// Apply sensible defaults so the server starts cleanly even without a full .env
process.env.PORT      = process.env.PORT      || '8080';
process.env.NODE_ENV  = process.env.NODE_ENV  || 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_before_production';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── 2. Preflight checks ──────────────────────────────────────────────────────

// Check Node version (need ≥ 18 for --watch flag)
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`${RED}✖  Node.js 18+ required (found ${process.versions.node}).${R}`);
  console.error(`   Download: https://nodejs.org`);
  process.exit(1);
}

// Check node_modules exist
const rootModules = path.join(ROOT, 'node_modules');
const apiModules  = path.join(API_DIR, 'node_modules');
const webModules  = path.join(WEB_DIR, 'node_modules');

const missingModules =
  !fs.existsSync(rootModules) &&
  !fs.existsSync(apiModules)  &&
  !fs.existsSync(webModules);

if (missingModules) {
  console.error(`${RED}✖  node_modules not found.${R}`);
  console.error(`   Run:  ${CYAN}pnpm install --force${R}  (or npm install) then retry.\n`);
  process.exit(1);
}

// ─── 3. Find the Vite binary ──────────────────────────────────────────────────
function findBin(name) {
  const ext = os.platform() === 'win32' ? '.cmd' : '';
  const candidates = [
    path.join(WEB_DIR,  'node_modules', '.bin', name + ext),
    path.join(ROOT,     'node_modules', '.bin', name + ext),
    path.join(API_DIR,  'node_modules', '.bin', name + ext),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback: try resolving from PATH via `which` / `where`
  try {
    const found = execSync(
      os.platform() === 'win32' ? `where ${name}` : `which ${name}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim().split('\n')[0];
    if (found && fs.existsSync(found)) return found;
  } catch (_) {}
  return null;
}

const viteBin = findBin('vite');
if (!viteBin) {
  console.error(`${RED}✖  vite binary not found.${R}`);
  console.error(`   Run:  ${CYAN}pnpm install --force${R}  then retry.\n`);
  process.exit(1);
}

// ─── 4. Spawn helper ─────────────────────────────────────────────────────────
function spawnProc(label, color, command, args, cwd, extraEnv = {}) {
  const isWin = os.platform() === 'win32';
  const proc  = spawn(command, args, {
    cwd,
    env:   { ...process.env, ...extraEnv },
    shell: isWin,   // Windows needs shell:true for .cmd binaries
    stdio: 'pipe',
  });

  const fwd = (stream, dest) =>
    stream.on('data', data =>
      data.toString().split('\n').forEach(line => {
        const l = line.trimEnd();
        if (l) dest.write(tag(label, color) + l + '\n');
      })
    );

  fwd(proc.stdout, process.stdout);
  fwd(proc.stderr, process.stderr);

  proc.on('error', err => {
    console.error(`${tag(label, RED)}Failed to start: ${err.message}`);
    shutdown('PROC_ERROR');
  });

  proc.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') return; // clean shutdown
    console.log(`\n${YELLOW}[${label}] exited (code=${code ?? signal})${R}`);
    // Kill sibling processes before exiting so nothing is left orphaned
    shutdown('PROC_EXIT');
    setTimeout(() => process.exit(typeof code === 'number' ? code : 1), 1500);
  });

  return proc;
}

// ─── 5. Banner ────────────────────────────────────────────────────────────────
console.log(`
${GREEN}${BOLD}╔════════════════════════════════════════╗${R}
${GREEN}${BOLD}║       WhatsApp Web Clone — Dev         ║${R}
${GREEN}${BOLD}╚════════════════════════════════════════╝${R}

  ${GREEN}Backend ${R} → ${CYAN}http://localhost:${process.env.PORT}${R}   (Express + Socket.IO)
  ${CYAN}Frontend${R} → ${CYAN}http://localhost:5173${R}  (React + Vite)

  ${BOLD}Open ${CYAN}http://localhost:5173${R}${BOLD} in your browser.${R}
`);

// ─── 6. Start processes ───────────────────────────────────────────────────────

// Backend — Node with --watch for auto-restart on file changes
const api = spawnProc(
  'API', GREEN,
  process.execPath,                  // same `node` binary that launched this script
  ['--watch', 'src/index.js'],
  API_DIR,
);

// Frontend — Vite dev server with the local config (no Replit plugins, /api proxy)
const web = spawnProc(
  'WEB', CYAN,
  viteBin,
  ['--config', 'vite.config.local.js', '--port', '5173', '--host', '0.0.0.0'],
  WEB_DIR,
);

// ─── 7. Graceful shutdown ─────────────────────────────────────────────────────
let shuttingDown = false;
function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${YELLOW}Shutting down (${sig})...${R}`);
  try { web.kill('SIGTERM'); } catch (_) {}
  try { api.kill('SIGTERM'); } catch (_) {}
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// Windows Ctrl-C fires SIGINT but also sometimes 'close' on stdin
if (os.platform() === 'win32') {
  process.stdin.resume();
}
