// PulseChat Client Logic & Real-Time Socket Dispatcher
const socket = io();

// State
let myUser = null;
let currentRoom = 'general';
let selectedAvatar = '👨‍💻';
let isTyping = false;
let typingTimeout = null;
let soundEnabled = true;
let activeDmRecipient = null;
const dmStore = new Map(); // recipientSocketId -> [messages]

// DOM Elements
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const avatarOptions = document.querySelectorAll('.avatar-option');

const myAvatarEl = document.getElementById('my-avatar');
const myNameEl = document.getElementById('my-name');

const roomListEl = document.getElementById('room-list');
const newRoomInput = document.getElementById('new-room-input');
const btnAddRoom = document.getElementById('btn-add-room');

const roomUserListEl = document.getElementById('room-user-list');
const globalUserListEl = document.getElementById('global-user-list');
const userCountEl = document.getElementById('user-count');

const activeRoomTitleEl = document.getElementById('active-room-title');
const activeRoomDescEl = document.getElementById('active-room-desc');
const messagesContainer = document.getElementById('messages-container');

const typingIndicatorBar = document.getElementById('typing-indicator-bar');
const typingTextEl = document.getElementById('typing-text');

const chatComposer = document.getElementById('chat-composer');
const messageInput = document.getElementById('message-input');
const btnSoundToggle = document.getElementById('btn-sound-toggle');

// DM Elements
const dmModal = document.getElementById('dm-modal');
const btnCloseDm = document.getElementById('btn-close-dm');
const dmRecipientName = document.getElementById('dm-recipient-name');
const dmRecipientAvatar = document.getElementById('dm-recipient-avatar');
const dmMessagesEl = document.getElementById('dm-messages');
const dmComposer = document.getElementById('dm-composer');
const dmInput = document.getElementById('dm-input');

// Audio Chime Generator using Web Audio API
function playChime(type = 'msg') {
  if (!soundEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'msg') {
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'dm') {
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.15); // C6
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch (e) {
    // Ignore audio autostart restrictions
  }
}

// Avatar selection
avatarOptions.forEach((opt) => {
  opt.addEventListener('click', () => {
    avatarOptions.forEach((o) => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.getAttribute('data-avatar');
  });
});

// 1. User Registration / Login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;

  socket.emit('user:login', {
    username,
    avatar: selectedAvatar
  });
});

socket.on('user:registered', (payload) => {
  myUser = payload.user;
  myAvatarEl.textContent = myUser.avatar;
  myNameEl.textContent = myUser.username;

  loginModal.classList.add('hidden');

  // Join initial room
  joinRoom('general');
});

// 2. Room Navigation
function joinRoom(room) {
  if (currentRoom === room && messagesContainer.children.length > 0) return;

  currentRoom = room;
  activeRoomTitleEl.textContent = `#${room}`;
  activeRoomDescEl.textContent = `Channel active: #${room}`;
  messageInput.placeholder = `Send a message to #${room}...`;

  // Update room list UI
  document.querySelectorAll('.room-item').forEach((item) => {
    if (item.getAttribute('data-room') === room) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  socket.emit('room:join', { room });
}

roomListEl.addEventListener('click', (e) => {
  const item = e.target.closest('.room-item');
  if (item) {
    const room = item.getAttribute('data-room');
    joinRoom(room);
  }
});

btnAddRoom.addEventListener('click', () => {
  const room = newRoomInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!room) return;

  // Check if exists in UI list
  let existing = document.querySelector(`.room-item[data-room="${room}"]`);
  if (!existing) {
    const li = document.createElement('li');
    li.className = 'room-item';
    li.setAttribute('data-room', room);
    li.innerHTML = `<span class="room-hash">#</span><span class="room-name">${room}</span>`;
    roomListEl.appendChild(li);
  }

  newRoomInput.value = '';
  joinRoom(room);
});

// 3. Receive Room History (Hydrates last 50 messages)
socket.on('room:history', (payload) => {
  messagesContainer.innerHTML = '';
  if (payload.messages && payload.messages.length > 0) {
    payload.messages.forEach((msg) => renderMessage(msg));
  } else {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'msg-system';
    emptyNotice.textContent = `Welcome to #${payload.room}! Be the first to start the conversation.`;
    messagesContainer.appendChild(emptyNotice);
  }
  scrollToBottom();
});

// 4. Receive Room Active Users
socket.on('room:userlist', (payload) => {
  if (payload.room !== currentRoom) return;

  userCountEl.textContent = payload.users.length;
  roomUserListEl.innerHTML = '';

  payload.users.forEach((u) => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.innerHTML = `
      <span class="u-avatar">${u.avatar}</span>
      <span class="u-name">${u.username} ${u.socketId === socket.id ? '(You)' : ''}</span>
      <span class="status-indicator online"></span>
    `;

    if (u.socketId !== socket.id) {
      li.title = `Click to send Direct Message to ${u.username}`;
      li.addEventListener('click', () => openDmModal(u));
    }

    roomUserListEl.appendChild(li);
  });
});

// 5. Global User Roster for Direct Messaging
socket.on('users:global_roster', (payload) => {
  globalUserListEl.innerHTML = '';

  const others = payload.users.filter((u) => u.socketId !== socket.id);
  if (others.length === 0) {
    const li = document.createElement('li');
    li.style.color = 'var(--text-muted)';
    li.style.fontSize = '0.78rem';
    li.style.padding = '0.4rem 0.8rem';
    li.textContent = 'No other users online';
    globalUserListEl.appendChild(li);
    return;
  }

  others.forEach((u) => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.innerHTML = `
      <span class="u-avatar">${u.avatar}</span>
      <span class="u-name">${u.username}</span>
      <span class="dm-badge">DM</span>
    `;
    li.addEventListener('click', () => openDmModal(u));
    globalUserListEl.appendChild(li);
  });
});

// 6. Send & Receive Chat Messages
chatComposer.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (!msg) return;

  socket.emit('chat:send', {
    room: currentRoom,
    message: msg
  });

  messageInput.value = '';
  stopTyping();
});

socket.on('chat:receive', (msg) => {
  if (msg.room && msg.room !== currentRoom) return;

  renderMessage(msg);
  scrollToBottom();

  if (msg.senderId !== socket.id && !msg.isSystem) {
    playChime('msg');
  }
});

function renderMessage(msg) {
  if (msg.isSystem) {
    const sysEl = document.createElement('div');
    sysEl.className = 'msg-system';
    sysEl.textContent = `${msg.message} • ${msg.timestamp}`;
    messagesContainer.appendChild(sysEl);
    return;
  }

  const isMe = msg.senderId === socket.id || (myUser && msg.sender === myUser.username);

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${isMe ? 'outgoing' : 'incoming'}`;

  wrapper.innerHTML = `
    <span class="msg-avatar">${msg.avatar || '👤'}</span>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-sender">${isMe ? 'You' : msg.sender}</span>
        <span class="msg-time">${msg.timestamp}</span>
      </div>
      <div class="msg-bubble">${escapeHtml(msg.message)}</div>
    </div>
  `;

  messagesContainer.appendChild(wrapper);
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 7. Typing Indicator with Debounce
messageInput.addEventListener('input', () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing:start', { room: currentRoom });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    stopTyping();
  }, 1500);
});

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    socket.emit('typing:stop', { room: currentRoom });
  }
}

socket.on('typing:update', (payload) => {
  if (payload.room !== currentRoom) return;

  if (payload.isTyping) {
    typingTextEl.textContent = `${payload.username} is typing...`;
    typingIndicatorBar.classList.add('visible');
  } else {
    typingIndicatorBar.classList.remove('visible');
  }
});

// 8. Direct Messaging (DM) Implementation
function openDmModal(user) {
  activeDmRecipient = user;
  dmRecipientName.textContent = user.username;
  dmRecipientAvatar.textContent = user.avatar;
  dmModal.classList.remove('hidden');

  renderDmMessages();
  dmInput.focus();
}

btnCloseDm.addEventListener('click', () => {
  dmModal.classList.add('hidden');
  activeDmRecipient = null;
});

dmComposer.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = dmInput.value.trim();
  if (!text || !activeDmRecipient) return;

  socket.emit('direct:send', {
    recipientId: activeDmRecipient.socketId,
    message: text
  });

  dmInput.value = '';
});

socket.on('direct:sent', (dm) => {
  if (!dmStore.has(dm.toId)) dmStore.set(dm.toId, []);
  dmStore.get(dm.toId).push({ ...dm, isOutgoing: true });

  if (activeDmRecipient && activeDmRecipient.socketId === dm.toId) {
    renderDmMessages();
  }
});

socket.on('direct:receive', (dm) => {
  if (!dmStore.has(dm.fromId)) dmStore.set(dm.fromId, []);
  dmStore.get(dm.fromId).push({ ...dm, isOutgoing: false });

  playChime('dm');

  if (activeDmRecipient && activeDmRecipient.socketId === dm.fromId) {
    renderDmMessages();
  } else {
    // Alert user about new incoming DM
    alert(`💬 New Direct Message from ${dm.from}: "${dm.message}"`);
  }
});

function renderDmMessages() {
  dmMessagesEl.innerHTML = '';
  if (!activeDmRecipient) return;

  const history = dmStore.get(activeDmRecipient.socketId) || [];

  if (history.length === 0) {
    const notice = document.createElement('div');
    notice.className = 'msg-system';
    notice.textContent = `Direct connection with ${activeDmRecipient.username}. Messages are private.`;
    dmMessagesEl.appendChild(notice);
    return;
  }

  history.forEach((dm) => {
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${dm.isOutgoing ? 'outgoing' : 'incoming'}`;
    wrapper.innerHTML = `
      <div class="msg-content">
        <div class="msg-bubble">${escapeHtml(dm.message)}</div>
        <span class="msg-time" style="font-size: 0.68rem; margin-top: 2px;">${dm.timestamp}</span>
      </div>
    `;
    dmMessagesEl.appendChild(wrapper);
  });

  dmMessagesEl.scrollTop = dmMessagesEl.scrollHeight;
}

// Sound toggle
btnSoundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  btnSoundToggle.textContent = soundEnabled ? '🔔' : '🔕';
  btnSoundToggle.title = soundEnabled ? 'Sound alerts enabled' : 'Sound alerts muted';
});
