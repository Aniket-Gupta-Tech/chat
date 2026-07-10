---
name: Single-Node consolidation
description: Why this repo is a single Node.js app instead of Replit's artifacts/pnpm-workspace layout, and what to preserve when touching it.
---

The user explicitly asked to move this chat app off Replit's multi-artifact/pnpm-workspace structure (separate `artifacts/api-server` + `artifacts/chat-app` folders, separate ports/workflows) into one plain Node.js project: single `.env` at repo root, single `server.js` entry point, single port, single `package.json`. Motivation: they were deploying to Vercel and hit root-directory/build-command/output-dir errors caused by the split-folder layout.

**Why:** the split-artifact layout that Replit normally scaffolds is optimized for Replit's own preview/workflow system, not for third-party PaaS deploys (Vercel/Render) that expect one build command and one start command.

**How to apply:** if asked to add a new backend/frontend feature here, keep it inside the existing single-app layout (`src/` for backend, `client/` for frontend, both served by root `server.js` on one port) — do not reintroduce a Replit artifact/pnpm-workspace split unless the user asks to move back to Replit's managed multi-artifact model.
