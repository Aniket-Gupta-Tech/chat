import ConnectionRequest from '../models/ConnectionRequest.js';
import ChatRoom from '../models/ChatRoom.js';

export const registerConnectionHandlers = (io, socket) => {
  const user = socket.user;

  // Sender notifies receiver — validate sender owns the request
  socket.on('notify_connection_request', async ({ requestId, receiverId }) => {
    try {
      const request = await ConnectionRequest.findById(requestId)
        .populate('senderId', 'username')
        .populate('receiverId', 'username');

      if (!request) return;

      // Only the actual sender can notify
      if (!request.senderId._id.equals(user._id)) {
        return socket.emit('error', { message: 'Not authorized to notify this request' });
      }

      io.to(`user:${request.receiverId._id}`).emit('incoming_connection_request', {
        requestId: request._id,
        sender: {
          _id: request.senderId._id,
          username: request.senderId.username,
        },
        expiresAt: request.expiryTime,
      });
    } catch (err) {
      console.error('notify_connection_request error:', err);
    }
  });

  // Notify sender — validate current user is room participant
  socket.on('connection_accepted', async ({ senderId, roomId }) => {
    try {
      const room = await ChatRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found' });

      const isParticipant = room.participants.some((p) => p.equals(user._id));
      if (!isParticipant) return socket.emit('error', { message: 'Not authorized' });

      io.to(`user:${senderId}`).emit('connection_established', {
        roomId,
        acceptedBy: user.username,
      });
    } catch (err) {
      console.error('connection_accepted error:', err);
    }
  });

  // Notify sender — validate current user is the receiver of the request
  socket.on('connection_rejected', async ({ senderId, requestId }) => {
    try {
      const request = await ConnectionRequest.findById(requestId);
      if (!request) return;

      if (!request.receiverId.equals(user._id)) {
        return socket.emit('error', { message: 'Not authorized to reject this request' });
      }

      io.to(`user:${senderId}`).emit('connection_rejected', {
        requestId,
        rejectedBy: user.username,
      });
    } catch (err) {
      console.error('connection_rejected error:', err);
    }
  });

  // End chat — validate current user is a participant of the room
  socket.on('end_chat', async ({ roomId, otherUserId }) => {
    try {
      const room = await ChatRoom.findOne({ roomId });
      if (!room) return socket.emit('error', { message: 'Room not found' });

      const isParticipant = room.participants.some((p) => p.equals(user._id));
      if (!isParticipant) return socket.emit('error', { message: 'Not authorized' });

      const payload = { roomId, endedBy: { _id: user._id, username: user.username } };

      // Notify everyone in the room including the sender so their local state updates
      io.to(roomId).emit('chat_ended', payload);
      // Also notify the other user's personal channel in case they left the room socket
      socket.to(`user:${otherUserId}`).emit('chat_ended', payload);

      socket.leave(roomId);
    } catch (err) {
      console.error('end_chat error:', err);
    }
  });
};
