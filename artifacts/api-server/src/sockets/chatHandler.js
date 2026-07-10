import Message from '../models/Message.js';
import ChatRoom from '../models/ChatRoom.js';

export const registerChatHandlers = (io, socket) => {
  const user = socket.user;

  // Join a room
  socket.on('join_room', async ({ roomId }) => {
    try {
      const room = await ChatRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found' });

      const isParticipant = room.participants.some((p) => p.equals(user._id));
      if (!isParticipant) return socket.emit('error', { message: 'Not authorized' });

      socket.join(roomId);

      // Mark messages as delivered + read
      await Message.updateMany(
        { roomId, receiverId: user._id, delivered: false },
        { delivered: true }
      );
      await Message.updateMany(
        { roomId, receiverId: user._id, read: false },
        { read: true, readAt: new Date() }
      );

      // Notify sender their messages were read
      socket.to(roomId).emit('messages_read', { roomId, readBy: user._id });

      socket.emit('joined_room', { roomId });
    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    socket.emit('left_room', { roomId });
  });

  // Send message — constrain receiverId to the other room participant
  socket.on('send_message', async ({ roomId, content, receiverId, type = 'text' }) => {
    try {
      const room = await ChatRoom.findOne({ roomId, active: true });
      if (!room) {
        return socket.emit('error', { message: 'Room is closed or does not exist' });
      }

      const isParticipant = room.participants.some((p) => p.equals(user._id));
      if (!isParticipant) return socket.emit('error', { message: 'Not authorized' });

      // Enforce: receiverId must be the other participant in this room
      const otherParticipant = room.participants.find((p) => !p.equals(user._id));
      if (!otherParticipant) return socket.emit('error', { message: 'No other participant found' });

      // Reject if client-supplied receiverId doesn't match the actual other participant
      if (otherParticipant.toString() !== receiverId) {
        return socket.emit('error', { message: 'Invalid receiverId' });
      }

      // Check if receiver is in the room (for delivery status)
      const roomSockets = await io.in(roomId).fetchSockets();
      const receiverOnline = roomSockets.some(
        (s) => s.user && s.user._id.toString() === receiverId
      );

      const message = await Message.create({
        roomId,
        senderId: user._id,
        receiverId: otherParticipant,
        type,
        content,
        delivered: receiverOnline,
        read: false,
      });

      await message.populate([
        { path: 'senderId', select: 'username' },
        { path: 'receiverId', select: 'username' },
      ]);

      const msgObj = message.toObject();

      // Emit to all in room
      io.to(roomId).emit('new_message', msgObj);

      // If receiver is online but not in room, send notification
      if (!receiverOnline) {
        socket.to(`user:${receiverId}`).emit('message_notification', {
          roomId,
          message: msgObj,
        });
      }
    } catch (err) {
      console.error('send_message error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on('typing_start', ({ roomId }) => {
    socket.to(roomId).emit('user_typing', { userId: user._id, username: user.username, roomId });
  });

  socket.on('typing_stop', ({ roomId }) => {
    socket.to(roomId).emit('user_stop_typing', { userId: user._id, roomId });
  });

  // Mark messages read
  socket.on('mark_read', async ({ roomId }) => {
    try {
      const result = await Message.updateMany(
        { roomId, receiverId: user._id, read: false },
        { read: true, readAt: new Date() }
      );

      if (result.modifiedCount > 0) {
        socket.to(roomId).emit('messages_read', { roomId, readBy: user._id });
      }
    } catch (err) {
      console.error('mark_read error:', err);
    }
  });
};
