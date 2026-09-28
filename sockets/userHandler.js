const {
  addUser,
  getUser,
  updateUserRoom,
  removeUser,
  getUsersInRoom,
  getRoomHistory,
  getAllUsers
} = require('../utils/messageStore');

module.exports = (io, socket) => {
  // Register user session upon initial login
  socket.on('user:login', (payload) => {
    try {
      const username = (payload.username || 'Anonymous').trim();
      const avatar = payload.avatar || 'avatar-1';

      const user = addUser(socket.id, {
        username,
        avatar
      });

      socket.emit('user:registered', {
        socketId: socket.id,
        user
      });

      // Broadcast updated online roster to all users
      io.emit('users:global_roster', { users: getAllUsers() });
    } catch (err) {
      console.error('Error in user:login:', err.message);
    }
  });

  // Join a designated chat channel/room
  socket.on('room:join', (payload) => {
    try {
      const targetRoom = (payload.room || 'general').trim();
      const user = getUser(socket.id);

      if (!user) return;

      const previousRoom = user.currentRoom;

      // Leave previous room if switching
      if (previousRoom && previousRoom !== targetRoom) {
        socket.leave(previousRoom);
        io.to(previousRoom).emit('room:userlist', {
          room: previousRoom,
          users: getUsersInRoom(previousRoom)
        });

        io.to(previousRoom).emit('chat:receive', {
          id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          sender: 'System',
          avatar: 'system',
          message: `${user.username} left the room.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          room: previousRoom,
          isSystem: true
        });
      }

      // Join new room
      socket.join(targetRoom);
      updateUserRoom(socket.id, targetRoom);

      // 1. Send recent message history buffer to the newly joined peer
      socket.emit('room:history', {
        room: targetRoom,
        messages: getRoomHistory(targetRoom)
      });

      // 2. Broadcast updated active user roster to everyone in this room
      io.to(targetRoom).emit('room:userlist', {
        room: targetRoom,
        users: getUsersInRoom(targetRoom)
      });

      // 3. Notify existing participants in the room
      socket.to(targetRoom).emit('chat:receive', {
        id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sender: 'System',
        avatar: 'system',
        message: `${user.username} joined #${targetRoom}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        room: targetRoom,
        isSystem: true
      });

      // Update global users list
      io.emit('users:global_roster', { users: getAllUsers() });
    } catch (err) {
      console.error('Error in room:join:', err.message);
    }
  });

  // Explicitly leave a room
  socket.on('room:leave', (payload) => {
    try {
      const room = payload.room;
      const user = getUser(socket.id);
      if (!room || !user) return;

      socket.leave(room);
      updateUserRoom(socket.id, null);

      io.to(room).emit('room:userlist', {
        room,
        users: getUsersInRoom(room)
      });

      io.to(room).emit('chat:receive', {
        id: `sys_${Date.now()}`,
        sender: 'System',
        avatar: 'system',
        message: `${user.username} has left the room.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        room,
        isSystem: true
      });

      io.emit('users:global_roster', { users: getAllUsers() });
    } catch (err) {
      console.error('Error in room:leave:', err.message);
    }
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    try {
      const user = removeUser(socket.id);
      if (user && user.currentRoom) {
        io.to(user.currentRoom).emit('room:userlist', {
          room: user.currentRoom,
          users: getUsersInRoom(user.currentRoom)
        });

        io.to(user.currentRoom).emit('chat:receive', {
          id: `sys_${Date.now()}`,
          sender: 'System',
          avatar: 'system',
          message: `${user.username} disconnected.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          room: user.currentRoom,
          isSystem: true
        });
      }

      // Update global roster
      io.emit('users:global_roster', { users: getAllUsers() });
    } catch (err) {
      console.error('Error in disconnect handler:', err.message);
    }
  });
};
