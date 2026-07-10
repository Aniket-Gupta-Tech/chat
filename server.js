/**
 * server.js — single entry point for the whole project.
 *
 *   node server.js
 *
 * Starts one Express + Socket.IO server on ONE port that:
 *  - Serves the REST API under /api
 *  - Serves Socket.IO under /api/socket.io
 *  - Serves the built React frontend (client/dist) for everything else
 *
 * If the frontend hasn't been built yet, it is built automatically
 * (via `vite build`) before the server starts.
 */

'use strict';

import 'dotenv/config';

import path from 'path';
import fs from 'fs';
import http from 'http';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import connectDB from './src/config/db.js';
import apiRoutes from './src/routes/index.js';
import { initSocket } from './src/sockets/index.js';
import { setIO } from './src/services/socketService.js';
import { startCleanupService } from './src/services/cleanupService.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(ROOT, 'dist');

// ─── Env defaults ───────────────────────────────────────────────────────────
process.env.PORT = process.env.PORT || '8080';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

if (!process.env.JWT_SECRET) {
  console.error('✖ JWT_SECRET is not set. Add it to your .env file (any long random string, 32+ chars).');
  process.exit(1);
}

const PORT = process.env.PORT;

// ─── Build the frontend automatically if missing ───────────────────────────
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('[build] No frontend build found — building now (vite build)...');
  execSync('npx vite build --config client/vite.config.js', { cwd: ROOT, stdio: 'inherit' });
}

async function main() {
  await connectDB();

  const app = express();
  const httpServer = http.createServer(app);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(mongoSanitize());

  app.use('/api', apiRoutes);
  app.use('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found' }));

  // Serve the built frontend for everything else (SPA fallback)
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  const io = initSocket(httpServer);
  setIO(io);
  startCleanupService();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   App:      http://localhost:${PORT}/`);
    console.log(`   API:      http://localhost:${PORT}/api`);
    console.log(`   Socket:   /api/socket.io`);
  });
}

main().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
