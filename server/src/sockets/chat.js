// server/src/sockets/chat.js
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// In-memory map of connected user IDs to socket IDs
const connectedUsers = new Map();

const setupChatSocket = (io) => {
  // Middleware: authenticate every socket connection via JWT
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        console.log('⚠️ No token provided for socket connection');
        return next(new Error('Authentication required.'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      console.log(`🔐 Socket authenticated for user: ${decoded.id}`);
      next();
    } catch (error) {
      console.log('⚠️ Invalid token for socket connection:', error.message);
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    
    // Store previous socket for this user if exists
    if (connectedUsers.has(socket.userId)) {
      const oldSocketId = connectedUsers.get(socket.userId);
      console.log(`🔄 User ${socket.userId} reconnected, updating socket mapping`);
      // Don't disconnect the old socket, just update the mapping
    }
    
    connectedUsers.set(socket.userId, socket.id);

    // Join a private room based on user ID (used for targeted messages)
    socket.join(`user_${socket.userId}`);

    // Broadcast updated online user list to all clients
    io.emit('users:online', Array.from(connectedUsers.keys()));

    // Join a specific room (e.g., a booking conversation room)
    socket.on('chat:join', (data) => {
      const { room } = data;
      if (room) {
        socket.join(room);
        console.log(`📢 User ${socket.userId} joined room: ${room}`);
      }
    });

    // Handle incoming chat message: persist to DB and emit to both parties
    socket.on('chat:message', async (data) => {
      try {
        const { receiver_id, content, booking_id } = data;

        if (!receiver_id || !content) {
          console.log(`⚠️ Invalid chat message from ${socket.userId}: missing receiver or content`);
          return;
        }

        console.log(`💬 Chat message from ${socket.userId} to ${receiver_id}: ${content.substring(0, 30)}...`);

        const result = await db.query(
          'INSERT INTO messages (sender_id, receiver_id, content, booking_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
          [socket.userId, receiver_id, content, booking_id || null]
        );

        const messageData = {
          id: result.rows[0].id,
          sender_id: socket.userId,
          receiver_id,
          content,
          booking_id: booking_id || null,
          created_at: result.rows[0].created_at,
        };

        // Send to receiver's room and back to sender
        io.to(`user_${receiver_id}`).emit('chat:message', messageData);
        socket.emit('chat:message', messageData);
        console.log(`✅ Message sent to user ${receiver_id}`);
      } catch (error) {
        console.error('❌ Chat message error:', error);
        socket.emit('chat:error', { error: 'Failed to send message.' });
      }
    });

    // Typing indicator: broadcast to the receiver
    socket.on('chat:typing', (data) => {
      const { receiver_id, is_typing } = data;
      io.to(`user_${receiver_id}`).emit('chat:typing', {
        sender_id: socket.userId,
        is_typing,
      });
    });

    // Mark messages as read for a given sender
    socket.on('chat:read', async (data) => {
      const { sender_id } = data;
      try {
        console.log(`📖 User ${socket.userId} marked messages from ${sender_id} as read`);
        await db.query(
          'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
          [sender_id, socket.userId]
        );
        io.to(`user_${sender_id}`).emit('chat:read', {
          read_by: socket.userId,
        });
      } catch (error) {
        console.error('❌ Mark read error:', error);
      }
    });

    // Handle ping to keep connection alive
    socket.on('chat:ping', () => {
      socket.emit('chat:pong');
    });

    // Cleanup on disconnect
    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.userId} (Reason: ${reason})`);
      
      // Only remove if this is the current socket for this user
      if (connectedUsers.get(socket.userId) === socket.id) {
        connectedUsers.delete(socket.userId);
        console.log(`🗑️ Removed user ${socket.userId} from connected users`);
        io.emit('users:online', Array.from(connectedUsers.keys()));
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`⚠️ Socket error for user ${socket.userId}:`, error.message);
    });
  });

  // Handle server-level errors
  io.on('error', (error) => {
    console.error('❌ Server socket error:', error);
  });
};

module.exports = { setupChatSocket, connectedUsers };