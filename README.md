# Chat App — Real-Time Chat & File Sharing

A production-ready, WhatsApp Web-style real-time chat application with 1-on-1 messaging, file/image sharing, and a 2-digit MFA connection flow.

---

## ▶ Run Locally

This is a single Node.js project — one `.env`, one server, one port. No separate frontend/backend folders to juggle.

### Prerequisites

| Tool | Minimum version | Download |
|------|----------------|---------|
| Node.js | 18 | https://nodejs.org |

### Step 1 — Clone & install dependencies

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### Step 2 — Create your `.env` file

Create a `.env` file in the project root:

```env
# Required — get a free cluster at https://www.mongodb.com/atlas
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/chatapp

# Required — any long random string (min 32 chars)
JWT_SECRET=replace_with_a_long_random_string_min_32_chars

# Optional — these have sensible defaults
JWT_EXPIRE=7d
PORT=8080
NODE_ENV=development
```

### Step 3 — Start the project

```bash
node server.js
```

That's it — **one command, one server, one port**. It builds the React frontend automatically (first run only) and then serves everything — API, Socket.IO, and the app itself — from `http://localhost:8080`.

Open **http://localhost:8080** in your browser.

Press **Ctrl+C** to stop.

If you change frontend code in `client/src`, rebuild with `npm run build` (or delete the `dist/` folder and restart `node server.js` — it rebuilds automatically).

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `node_modules not found` | Run `npm install` |
| MongoDB connection fails | Check `MONGO_URI` in `.env` — the app still starts but DB routes will fail |
| Port 8080 in use | Set `PORT=8081` in `.env` |
| Node version error | Install Node 18+ from https://nodejs.org |
| Frontend changes not showing | Run `npm run build`, or delete `dist/` and restart `node server.js` |

---

## Deploying (Vercel, Render, etc.)

Since this is a plain single Node.js app now, deployment config is simple:

- **Build command:** `npm run build`
- **Start command:** `node server.js` (or `npm start`)
- **Root directory:** repo root (no subfolder)
- **Environment variables:** set `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `PORT` (most platforms set `PORT` for you), `NODE_ENV=production`

---

## Replit

On Replit the app starts automatically via the `Server` workflow (`node server.js`). Set `MONGO_URI` as a Replit Secret if not already configured.

---

## How to Use

### Registration & Login
1. Open the app at `/`
2. Click **Register** tab
3. Enter a unique username (letters, numbers, underscores — 3–30 chars)
4. You're logged in — token stored in browser, persists on refresh

### Starting a Chat (2-digit MFA Flow)
1. Click **Search Users** tab in the sidebar
2. Type a username to find another registered user
3. Click **Connect**
4. **Enter a 2-digit code** (10–99) in the popup — share this code verbally with the other person
5. The other user sees a connection popup — they enter the same code
6. If codes match → private room created, chat enabled
7. If codes don't match → 3 attempts allowed, then 5-minute block
8. Code expires after 60 seconds

### Sending Messages
- Type in the input field and press Enter or click Send
- Click the 😊 button to open the emoji picker
- Real-time delivery and read receipts (✓ = sent, ✓✓ = delivered, blue ✓✓ = read)
- Typing indicator shows when the other person is typing

### File & Image Sharing
- Click the **paperclip** icon to upload any supported file
- Images show as inline previews
- Files show filename, size, and a download button
- Max file size: **20MB**
- Supported: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt`, `.zip`, `.png`, `.jpg`, `.jpeg`
- Blocked: executables and scripts (`.exe`, `.bat`, `.sh`, etc.)

### Multiple Chats
- Maintain multiple simultaneous chat rooms (e.g. Aniket ↔ Rahul, Aniket ↔ Priya)
- Each room is independent — separate messages, files, and disconnect
- Unread badge count per room
- Last message preview in sidebar

### Ending a Chat
- Click **End Chat** button in the chat header
- Room is permanently closed (read-only view preserved)
- Both participants see a "This chat has ended" banner

### Dark / Light Mode
- Click the moon/sun icon in the sidebar header to toggle
- Preference saved in localStorage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, React Router DOM, Socket.IO Client, Axios |
| Backend | Node.js, Express.js, Socket.IO |
| Database | MongoDB + Mongoose |
| Auth | JWT (localStorage) |
| File Storage | Local disk (`uploads/`) |
| Security | Helmet, express-rate-limit, express-mongo-sanitize, bcryptjs |

---

## Project Structure

```
server.js               # Single entry point — Express + Socket.IO + serves the built frontend
.env                     # Single env file (root only)

src/                     # Backend (Express, plain ESM)
  config/                # MongoDB connection
  models/                # Mongoose models (User, Message, ChatRoom, File, ConnectionRequest)
  routes/                # Express route handlers
  controllers/           # Business logic
  middleware/            # Auth (JWT), file upload (Multer), security
  sockets/               # Socket.IO event handlers
  services/              # Code generation (2-digit MFA), socket service
  utils/                 # JWT helpers

client/                  # React + Vite frontend (built into dist/)
  src/
    contexts/            # AuthContext, SocketContext, ChatContext
    services/            # Axios API client
    hooks/               # useAuth, useSocket, useChat
    pages/               # LoginPage, ChatPage
    components/          # Sidebar, ChatWindow, MessageBubble, file/connection components

dist/                    # Built frontend static assets (generated, gitignored)
uploads/                 # Uploaded files (auto-created)
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{ username }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ username }` | `{ token, user }` |
| GET | `/api/auth/me` | — | `{ user }` |

### Users
| Method | Endpoint | Query/Params | Response |
|--------|----------|------|----------|
| GET | `/api/users/search` | `?q=username` | `{ users }` |
| GET | `/api/users/online` | — | `{ users }` |
| GET | `/api/users/:id` | — | `{ user }` |

### Connections (2-digit MFA)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/connections/request` | `{ receiverUsername, code }` | `{ requestId, receiverId, expiresAt }` |
| POST | `/api/connections/verify` | `{ requestId, code }` | `{ success, roomId, room }` |
| POST | `/api/connections/reject` | `{ requestId }` | `{ success }` |

### Rooms
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/rooms` | `{ rooms }` (with lastMessage, unreadCount) |
| GET | `/api/rooms/:roomId` | `{ room }` |
| POST | `/api/rooms/:roomId/end` | `{ success }` |

### Messages
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/messages/:roomId?page=1&limit=50` | `{ messages, page, hasMore }` |
| PATCH | `/api/messages/:roomId/read` | `{ success }` |

### Files
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/files/upload/:roomId` | FormData: `{ file, receiverId }` | `{ file, message }` |
| GET | `/api/files/:fileId/download` | — | File download |
| GET | `/api/files/:fileId/view` | — | Inline file (images) |
| GET | `/api/files/room/:roomId` | — | `{ files }` |

---

## Socket.IO Events

**Connect:** `io(origin, { path: '/api/socket.io', auth: { token } })`

### Client → Server
| Event | Payload |
|-------|---------|
| `join_room` | `{ roomId }` |
| `leave_room` | `{ roomId }` |
| `send_message` | `{ roomId, content, receiverId, type }` |
| `typing_start` | `{ roomId }` |
| `typing_stop` | `{ roomId }` |
| `mark_read` | `{ roomId }` |
| `notify_connection_request` | `{ requestId, receiverId }` |
| `connection_accepted` | `{ senderId, roomId }` |
| `connection_rejected` | `{ senderId, requestId }` |
| `end_chat` | `{ roomId, otherUserId }` |

### Server → Client
| Event | Payload |
|-------|---------|
| `new_message` | Message object |
| `user_typing` | `{ userId, username, roomId }` |
| `user_stop_typing` | `{ userId, roomId }` |
| `messages_read` | `{ roomId, readBy }` |
| `user_online` | `{ userId, username }` |
| `user_offline` | `{ userId, username, lastSeen }` |
| `incoming_connection_request` | `{ requestId, sender, expiresAt }` |
| `connection_established` | `{ roomId, acceptedBy }` |
| `connection_rejected` | `{ requestId, rejectedBy }` |
| `chat_ended` | `{ roomId, endedBy }` |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | **Required** |
| `JWT_SECRET` | JWT signing secret | Set in dev env |
| `JWT_EXPIRE` | JWT expiry duration | `7d` |
| `CLIENT_URL` | Allowed CORS origin | `*` |
| `UPLOAD_PATH` | Upload directory path | `uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `20971520` (20MB) |
| `PORT` | Server port | `8080` |

---

## Security Features

- JWT authentication on all API routes and Socket.IO connections
- Room authorization — users can only access their own rooms, messages, and files
- Socket events validate ownership server-side (no client-trusted IDs)
- MongoDB sanitization (prevent NoSQL injection)
- Helmet security headers
- Rate limiting (500 req / 15 min)
- Multer file validation: allowed extensions + MIME types + max size
- Blocked file extensions: `.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`, `.msi`, `.dll`, `.vbs`, `.jar`, `.com`, `.scr`
- 2-digit MFA codes are hashed with bcrypt before storage
- Code expiry: 60 seconds
- Max attempts: 3, then 5-minute block
# chat
# chat
