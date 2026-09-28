const {
  getUser,
  addMessageToHistory
} = require('../utils/messageStore');

module.exports = (io, socket) => {
  // Send public room message
  socket.on('chat:send', (payload) => {
    try {
      const { room, message } = payload;
      const user = getUser(socket.id);

      if (!user || !room || !message || !message.trim()) return;

      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: user.username,
        senderId: socket.id,
        avatar: user.avatar,
        message: message.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        room: room.trim()
      };

      // 1. Buffer message in in-memory room store (max 50)
      addMessageToHistory(room, messageObj);

      // 2. Broadcast message to all members in the room
      io.to(room).emit('chat:receive', messageObj);
    } catch (err) {
      console.error('Error in chat:send:', err.message);
    }
  });

  // User starts typing in room
  socket.on('typing:start', (payload) => {
    try {
      const { room } = payload;
      const user = getUser(socket.id);
      if (!user || !room) return;

      // Broadcast to other members in the room only (excluding sender)
      socket.to(room).emit('typing:update', {
        username: user.username,
        isTyping: true,
        room
      });
    } catch (err) {
      console.error('Error in typing:start:', err.message);
    }
  });

  // User stops typing in room
  socket.on('typing:stop', (payload) => {
    try {
      const { room } = payload;
      const user = getUser(socket.id);
      if (!user || !room) return;

      socket.to(room).emit('typing:update', {
        username: user.username,
        isTyping: false,
        room
      });
    } catch (err) {
      console.error('Error in typing:stop:', err.message);
    }
  });

  // Private Direct Message (DM) to a specific socket
  socket.on('direct:send', (payload) => {
    try {
      const { recipientId, message } = payload;
      const sender = getUser(socket.id);
      const recipient = getUser(recipientId);

      if (!sender || !recipient || !message || !message.trim()) {
        socket.emit('direct:error', { message: 'Recipient not available or invalid message.' });
        return;
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dmPayload = {
        id: `dm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        from: sender.username,
        fromId: socket.id,
        to: recipient.username,
        toId: recipientId,
        avatar: sender.avatar,
        message: message.trim(),
        timestamp
      };

      // Deliver only to the intended recipient socket
      io.to(recipientId).emit('direct:receive', dmPayload);

      // Acknowledge back to sender
      socket.emit('direct:sent', dmPayload);
    } catch (err) {
      console.error('Error in direct:send:', err.message);
    }
  });
};
