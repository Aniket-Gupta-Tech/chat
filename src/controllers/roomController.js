import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';

// GET /api/rooms — list rooms for current user
export const getRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.find({
      participants: req.user._id,
    })
      .populate('participants', 'username onlineStatus lastSeen')
      .sort({ updatedAt: -1 });

    // Attach last message and unread count
    const roomsWithMeta = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await Message.findOne({ roomId: room.roomId })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          roomId: room.roomId,
          receiverId: req.user._id,
          read: false,
        });

        return {
          ...room.toObject(),
          lastMessage: lastMessage
            ? { content: lastMessage.content, type: lastMessage.type, createdAt: lastMessage.createdAt }
            : null,
          unreadCount,
        };
      })
    );

    return res.json({ rooms: roomsWithMeta });
  } catch (err) {
    console.error('getRooms error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/rooms/:roomId
export const getRoom = async (req, res) => {
  try {
    const room = await ChatRoom.findOne({ roomId: req.params.roomId }).populate(
      'participants',
      'username onlineStatus lastSeen'
    );

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p._id.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    return res.json({ room });
  } catch (err) {
    console.error('getRoom error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/rooms/:roomId/end
export const endRoom = async (req, res) => {
  try {
    const room = await ChatRoom.findOne({ roomId: req.params.roomId });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    if (!room.active) return res.status(400).json({ error: 'Room already ended' });

    room.active = false;
    room.endedBy = req.user._id;
    room.endedAt = new Date();
    await room.save();

    return res.json({ success: true, roomId: room.roomId });
  } catch (err) {
    console.error('endRoom error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
