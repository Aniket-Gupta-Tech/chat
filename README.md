# Chat App — Real-Time Chat & File Sharing

A production-ready, WhatsApp Web-style real-time chat application with 1-on-1 messaging, file/image sharing, and a 2-digit MFA connection flow.

---

## ▶ Run Locally in VS Code

### Prerequisites

| Tool | Minimum version | Download |
|------|----------------|---------|
| Node.js | 18 | https://nodejs.org |
| pnpm | 8 | `npm i -g pnpm` |

### Step 1 — Clone & install dependencies

```bash
git clone <your-repo-url>
cd <project-folder>
pnpm install --force
```

> `--force` ensures platform-specific native binaries (esbuild, rollup) are downloaded for your OS and CPU architecture.

### Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Required — get a free cluster at https://www.mongodb.com/atlas
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/chatapp

# Required — any long random string (min 32 chars)
JWT_SECRET=replace_with_a_long_random_string_min_32_chars

# Optional — these have sensible defaults
JWT_EXPIRE=7d
PORT=8080
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### Step 3 — Start everything

```bash
node server.js
```

That's it. One command starts both servers:

| Service | URL |
|---------|-----|
| **Frontend** (React + Vite) | http://localhost:5173 |
| **Backend** (Express + Socket.IO) | http://localhost:8080 |

Open **http://localhost:5173** in your browser. All `/api/*` calls are proxied automatically from Vite to the backend — no CORS issues, no extra config.

Press **Ctrl+C** to stop both servers cleanly.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `vite binary not found` | Run `pnpm install --force` |
| `node_modules not found` | Run `pnpm install --force` |
| MongoDB connection fails | Check `MONGO_URI` in `.env` — the app still starts but DB routes will fail |
| Port 8080 or 5173 in use | Change `PORT=8081` in `.env`; for Vite edit `vite.config.local.js` |
| Node version error | Install Node 18+ from https://nodejs.org |

---

## Replit

On Replit the backend and frontend start automatically via managed workflows. Set `MONGO_URI` as a Replit Secret (key = `MONGO_URI`).

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
| File Storage | Local disk (`artifacts/api-server/uploads/`) |
| Security | Helmet, express-rate-limit, express-mongo-sanitize, bcryptjs |

---

## Project Structure

```
artifacts/
  api-server/            # Express + Socket.IO backend (JavaScript)
    src/
      config/            # MongoDB connection
      models/            # Mongoose models (User, Message, ChatRoom, File, ConnectionRequest)
      routes/            # Express route handlers
      controllers/       # Business logic
      middleware/        # Auth (JWT), file upload (Multer), security
      sockets/           # Socket.IO event handlers
      services/          # Code generation (2-digit MFA), socket service
      utils/             # JWT helpers
    uploads/             # Uploaded files (auto-created)

  chat-app/              # React + Vite frontend (JavaScript / JSX)
    src/
      contexts/          # AuthContext, SocketContext, ChatContext
      services/          # Axios API client
      hooks/             # useAuth, useSocket, useChat
      pages/             # LoginPage, ChatPage
      components/        # Sidebar, ChatWindow, MessageBubble, file/connection components
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
| `UPLOAD_PATH` | Upload directory path | `artifacts/api-server/uploads` |
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
