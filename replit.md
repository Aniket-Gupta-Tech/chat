# Chat App — Real-Time Chat & File Sharing

A WhatsApp Web-style real-time chat app with 1-on-1 messaging, file/image sharing, and a 2-digit MFA connection flow.

This is a **single Node.js project** — one `.env`, one server, one port. No separate frontend/backend folders, no Replit artifacts/workspace split. Structured this way specifically so it deploys cleanly to platforms like Vercel/Render as a plain Node app.

## Run & Operate

- `node server.js` (or `npm start`) — the ONLY command needed. It:
  1. Loads `.env` from the project root
  2. Builds the React frontend with Vite if `dist/` doesn't exist yet
  3. Starts one Express + Socket.IO server on `PORT` (default 8080) that serves the REST API (`/api`), Socket.IO (`/api/socket.io`), and the built frontend (everything else) — all on the same port
- Replit runs this via the `Server` workflow.
- To rebuild the frontend after editing `client/src`: `npm run build` (or just delete `dist/` and restart the server — it rebuilds automatically).

## Required Environment (single `.env` at project root)

| Var | Description |
|-----|--------------|
| `MONGO_URI` | MongoDB connection string — required for all DB features |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRE` | Token expiry (default `7d`) |
| `PORT` | Server port (default `8080`) |
| `NODE_ENV` | `development` or `production` |
| `MAX_FILE_SIZE` | Max upload size in bytes |

There is only ONE `.env` file, at the project root. Do not create per-folder `.env` files.

## Stack

- **Frontend:** React 19, React Router, Socket.IO Client, Axios, Tailwind CSS + a handful of shadcn/ui primitives (button, card, dialog, input, tabs, toast)
- **Backend:** Node.js, Express 4, Socket.IO, JWT auth, Multer file uploads
- **Database:** MongoDB + Mongoose
- **Security:** Helmet, express-rate-limit, express-mongo-sanitize, bcryptjs
- **Build:** Vite (frontend only, output to `dist/`)

## Where Things Live

- `server.js` — single entry point (Express + Socket.IO + static frontend serving)
- `src/` — backend code (Express, plain ESM, no build step)
  - `models/` — Mongoose schemas (User, Message, ChatRoom, File, ConnectionRequest)
  - `routes/` + `controllers/` — REST API handlers
  - `middleware/` — JWT auth, Multer upload, security
  - `sockets/` — Socket.IO event handlers (chat, connection, presence)
  - `services/` — 2-digit MFA code service, socket instance service
- `client/` — React frontend source, built by Vite into `dist/` (served statically by `server.js`)
  - `src/contexts/` — AuthContext, SocketContext, ChatContext
  - `src/components/`, `src/pages/`, `src/services/api.js`
- `uploads/` — uploaded files (auto-created)
- `dist/` — built frontend static assets (generated, gitignored)

## Architecture Decisions

- Single Node.js project, single port, single `.env` — chosen so deployment (e.g. Vercel/Render) needs only "build: `npm run build`", "start: `node server.js`" with no root-directory/multi-service confusion.
- Socket.IO path is `/api/socket.io` (served through the same Express server as the REST API and the static frontend)
- File uploads create a DB record and a Message in one request; socket broadcasts the message to both participants
- 2-digit MFA codes are bcrypt-hashed before storage; never stored in plain text
- Socket events validate server-side ownership (senderId, room membership) — no client-trusted IDs
- File access always checks room participant membership; no public static file route

## Gotchas

- The server starts even without `MONGO_URI` (shows a warning) but all DB-dependent routes will fail
- Socket.IO connects at path `/api/socket.io` — clients must set `path` option explicitly
- All JWT tokens go in `localStorage` key `"token"`; auth header: `Authorization: Bearer <token>`
- File messages store content as a JSON string `{ fileId, filename, fileSize, mimeType, url }` — parse before rendering
- `server.js` auto-runs `vite build` if `dist/index.html` is missing — delete `dist/` to force a rebuild after frontend changes

## User Preferences

- User wants a single-file/single-folder Node.js project (not Replit's multi-artifact/pnpm-workspace layout) — this was a deliberate migration to simplify Vercel/Render deployment (previous split-folder setup caused root-directory/build-command/output-dir errors on Vercel).
