# 💬 Assignment 13: Real-Time Group Chat & Messaging Engine (Socket.io)

> **Track:** Backend & Real-Time Web | **Level:** Advanced | **Student:** Tanmay Sherkar  
> **Tech Stack:** Node.js, Express.js, Socket.io, In-Memory Message History Store, CORS, dotenv, nodemon

---

## 📌 1. Objective & Architecture Overview

A scalable **Real-Time Group Chat & Direct Messaging Engine** built with **Node.js, Express.js, and Socket.io**. Features dynamic multi-channel room creation (`#general`, `#developers`, `#random`), selective room message broadcasting, 1-on-1 private Direct Messages (`io.to(recipientSocketId)`), debounced typing indicators (`typing:start`, `typing:stop`), active presence tracking rosters, and capped in-memory message history hydration (last 50 messages) upon room connection.

### Key Architectural Highlights:
- **Multi-Channel Rooms**: Partitioned channels managed via `socket.join(roomName)` and `socket.leave(roomName)`.
- **Targeted Broadcasting**: Group messages are dispatched exclusively to channel participants (`io.to(room)`), and private DMs are routed only to the recipient's socket ID (`io.to(recipientSocketId)`).
- **Active Presence Tracking**: Tracks connected users with usernames, avatars, and current channel presence across client disconnects and room switches.
- **Debounced Typing Indicator**: Bouncing typing indicators broadcast exclusively to fellow room participants with an automatic 1.5s debounce timeout.
- **Message History Replay**: Caches the last 50 messages per room, immediately hydrating newly joined peers via `room:history`.
- **Zero-Dependency Synthesized Audio Alerts**: Utilizes the HTML5 Web Audio API to produce pleasant notification chimes on incoming room messages and DMs.

---

## 🏗️ 2. Project Directory Structure

```text
Tanmay-Sherkar-139-Assignment-13/
├── public/
│   ├── index.html           # Multi-room chat UI with dark theme & glassmorphism
│   ├── app.js               # Client socket event listeners & DOM updates
│   └── style.css            # Responsive chat bubbles, sidebar & typing indicator styles
├── sockets/
│   ├── chatHandler.js       # Room messaging, DM routing & typing indicator handlers
│   └── userHandler.js       # User login, room join/leave & disconnect lifecycle
├── utils/
│   └── messageStore.js      # In-memory history buffer (max 50) & active user rosters
├── server.js                # Express & Socket.io server bootstrap
├── package.json
├── .env.example
├── .env
├── .gitignore
└── README.md
```

---

## 📡 3. Real-Time Socket Event Protocol

### 🔄 Session & Room Management

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `user:login` | `Client -> Server` | `{ "username": "Aarav", "avatar": "👨‍💻" }` | Registers user identity and socket mapping |
| `user:registered` | `Server -> Client` | `{ "socketId": "xyz", "user": { ... } }` | Acknowledges session creation |
| `room:join` | `Client -> Server` | `{ "room": "developers" }` | Joins a specific chat channel |
| `room:history` | `Server -> Client` | `{ "room": "developers", "messages": [...] }` | Emits recent message history buffer to joined user |
| `room:userlist` | `Server -> Room` | `{ "room": "developers", "users": [...] }` | Broadcasts updated online users list in the room |
| `room:leave` | `Client -> Server` | `{ "room": "developers" }` | Leaves current channel |
| `users:global_roster` | `Server -> All` | `{ "users": [...] }` | Broadcasts all online users for Direct Messaging |

### 💬 Messaging & Indicators

| Event Name | Direction | Payload Schema | Description |
|---|:---:|---|---|
| `chat:send` | `Client -> Server` | `{ "room": "developers", "message": "Hey everyone!" }` | Sends message to a room |
| `chat:receive` | `Server -> Room` | `{ "id": "msg_123", "sender": "Aarav", "message": "Hey everyone!", "timestamp": "14:32" }` | Broadcasts message to all members in room |
| `typing:start` | `Client -> Server` | `{ "room": "developers" }` | User started typing in room |
| `typing:stop` | `Client -> Server` | `{ "room": "developers" }` | User stopped typing or sent message |
| `typing:update` | `Server -> Room` | `{ "username": "Aarav", "isTyping": true, "room": "developers" }` | Displays "Aarav is typing..." to others in room |
| `direct:send` | `Client -> Server` | `{ "recipientId": "socket_id_xyz", "message": "Secret DM" }` | Sends private direct message |
| `direct:receive`| `Server -> Client` | `{ "from": "Aarav", "fromId": "xyz", "message": "Secret DM", "timestamp": "14:35" }` | Delivered only to intended recipient socket |
| `direct:sent` | `Server -> Client` | `{ "to": "Priya", "toId": "xyz", "message": "Secret DM", "timestamp": "14:35" }` | Acknowledgment back to sender |

---

## 🧠 4. Server-Side Data Structures

```javascript
// utils/messageStore.js
const connectedUsers = new Map(); // socketId -> { username, avatar, currentRoom, joinedAt }

const roomHistories = {
  general: [],
  developers: [],
  random: []
};

const MAX_HISTORY = 50;

function addMessageToHistory(room, messageObj) {
  if (!roomHistories[room]) roomHistories[room] = [];
  roomHistories[room].push(messageObj);
  if (roomHistories[room].length > MAX_HISTORY) {
    roomHistories[room].shift();
  }
}
```

---

## 🚀 5. Setup & Running Instructions

### 1. Install Dependencies
```bash
cd Tanmay-Sherkar-139-Assignment-13
npm install
```

### 2. Configure Environment
```bash
PORT=5000
NODE_ENV=development
```

### 3. Start Server
```bash
# Development with auto-reload
npm run dev

# Or production
npm start
```

### 4. Open in Browser
Visit `http://localhost:5000` in multiple browser tabs or incognito windows.

---

## 🧪 6. Testing & Validation Walkthrough

1. **Multi-User Isolation**: Open three tabs (`Aarav`, `Priya`, `Rohan`). Have Aarav and Priya join `#developers`, while Rohan joins `#random`.
2. **Channel Scoping**: Aarav sends a message in `#developers`. Priya receives it in real time; Rohan in `#random` does not receive it.
3. **Debounced Typing Indicator**: When Aarav types in `#developers`, only Priya sees "Aarav is typing...". When Aarav stops typing, the indicator clears after 1.5 seconds.
4. **History Replay**: Open a fourth tab (`Kunal`), join `#developers`, and verify that all previous messages (up to 50) are instantly rendered via `room:history`.
5. **Private Direct Messages**: Click on Priya's handle in the sidebar and send a private DM. Priya receives the DM popup with sound alert. Rohan receives nothing.
