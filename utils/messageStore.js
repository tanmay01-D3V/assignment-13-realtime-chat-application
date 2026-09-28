// In-Memory Chat State and User Presence Management
const connectedUsers = new Map(); // socketId -> { username, avatar, currentRoom, joinedAt }

const roomHistories = {
  general: [],
  developers: [],
  random: []
};

const MAX_HISTORY = 50;

/**
 * Append message to room history buffer and cap to MAX_HISTORY
 */
function addMessageToHistory(room, messageObj) {
  if (!roomHistories[room]) {
    roomHistories[room] = [];
  }
  roomHistories[room].push(messageObj);
  if (roomHistories[room].length > MAX_HISTORY) {
    roomHistories[room].shift();
  }
}

/**
 * Retrieve recent history buffer for a room
 */
function getRoomHistory(room) {
  return roomHistories[room] ? [...roomHistories[room]] : [];
}

/**
 * Register or update connected user
 */
function addUser(socketId, userData) {
  connectedUsers.set(socketId, {
    socketId,
    username: userData.username,
    avatar: userData.avatar || 'avatar-1',
    currentRoom: userData.currentRoom || null,
    joinedAt: new Date().toISOString()
  });
  return connectedUsers.get(socketId);
}

/**
 * Retrieve user by socketId
 */
function getUser(socketId) {
  return connectedUsers.get(socketId);
}

/**
 * Update user's current active room
 */
function updateUserRoom(socketId, newRoom) {
  const user = connectedUsers.get(socketId);
  if (user) {
    user.currentRoom = newRoom;
    connectedUsers.set(socketId, user);
  }
  return user;
}

/**
 * Remove user upon disconnect
 */
function removeUser(socketId) {
  const user = connectedUsers.get(socketId);
  connectedUsers.delete(socketId);
  return user;
}

/**
 * Get all active users in a specific room
 */
function getUsersInRoom(room) {
  const users = [];
  for (const [id, user] of connectedUsers.entries()) {
    if (user.currentRoom === room) {
      users.push({
        socketId: id,
        username: user.username,
        avatar: user.avatar
      });
    }
  }
  return users;
}

/**
 * Get all online users across all rooms (for direct messaging roster)
 */
function getAllUsers() {
  const users = [];
  for (const [id, user] of connectedUsers.entries()) {
    users.push({
      socketId: id,
      username: user.username,
      avatar: user.avatar,
      currentRoom: user.currentRoom
    });
  }
  return users;
}

module.exports = {
  connectedUsers,
  roomHistories,
  MAX_HISTORY,
  addMessageToHistory,
  getRoomHistory,
  addUser,
  getUser,
  updateUserRoom,
  removeUser,
  getUsersInRoom,
  getAllUsers
};
