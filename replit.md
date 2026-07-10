# Chat App — Real-Time Chat & File Sharing

A WhatsApp Web-style real-time chat app with 1-on-1 messaging, file/image sharing, and a 2-digit MFA connection flow.

## Run & Operate

- Backend auto-starts: `pnpm --filter @workspace/api-server run dev` (port 8080, path `/api`)
- Frontend auto-starts: `pnpm --filter @workspace/chat-app run dev` (path `/`)
- Both run via Replit workflows — no manual commands needed

## Required Environment Secrets

| Secret | Description |
|--------|-------------|
| `MONGO_URI` | MongoDB connection string — **required for all features** |
| `JWT_SECRET` | JWT signing secret (a dev placeholder is set; change for production) |

Set `MONGO_URI` as a Replit Secret: `mongodb+srv://user:pass@cluster.mongodb.net/chatapp`

## Stack

- **Frontend:** React, React Router DOM, Socket.IO Client, Axios, Tailwind CSS + shadcn/ui
- **Backend:** Node.js 24, Express 4, Socket.IO, JWT authentication, Multer file uploads
- **Database:** MongoDB + Mongoose
- **Security:** Helmet, express-rate-limit, express-mongo-sanitize, bcryptjs

## Where Things Live

- `artifacts/api-server/src/` — Express + Socket.IO backend (JavaScript)
  - `models/` — Mongoose schemas (User, Message, ChatRoom, File, ConnectionRequest)
  - `routes/` + `controllers/` — REST API handlers
  - `middleware/` — JWT auth, Multer upload, security
  - `sockets/` — Socket.IO event handlers (chat, connection, presence)
  - `services/` — 2-digit MFA code service, socket instance service
- `artifacts/chat-app/src/` — React frontend (JSX)
  - `contexts/` — AuthContext, SocketContext, ChatContext
  - `components/` — Sidebar, ChatWindow, MessageBubble, file/connection components
  - `pages/` — LoginPage, ChatPage
  - `services/api.js` — Axios instance with auth interceptor
- `artifacts/api-server/uploads/` — uploaded files (auto-created)

## Architecture Decisions

- Socket.IO path is `/api/socket.io` (served through the same `/api` proxy as REST)
- File uploads create a DB record and a Message in one request; socket broadcasts the message to both participants
- 2-digit MFA codes are bcrypt-hashed before storage; never stored in plain text
- Socket events validate server-side ownership (senderId, room membership) — no client-trusted IDs
- File access always checks room participant membership; no public static file route

## Gotchas

- The server starts even without `MONGO_URI` (shows a warning) but all DB-dependent routes will fail
- Socket.IO connects at path `/api/socket.io` — clients must set `path` option explicitly
- All JWT tokens go in `localStorage` key `"token"`; auth header: `Authorization: Bearer <token>`
- File messages store content as a JSON string `{ fileId, filename, fileSize, mimeType, url }` — parse before rendering

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
