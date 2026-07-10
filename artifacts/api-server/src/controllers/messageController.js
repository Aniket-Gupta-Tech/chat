import Message from '../models/Message.js';
import ChatRoom from '../models/ChatRoom.js';

// GET /api/messages/:roomId
export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const room = await ChatRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    const messages = await Message.find({ roomId })
      .populate('senderId', 'username')
      .populate('receiverId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark unread messages as read
    await Message.updateMany(
      { roomId, receiverId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    return res.json({
      messages: messages.reverse(),
      page,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/messages/:roomId — send a message via REST (supplemental; primary is via socket)
export const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, receiverId, type = 'text' } = req.body;

    if (!content || !receiverId) {
      return res.status(400).json({ error: 'content and receiverId are required' });
    }

    const room = await ChatRoom.findOne({ roomId, active: true });
    if (!room) return res.status(404).json({ error: 'Room not found or has ended' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    const message = await Message.create({
      roomId,
      senderId: req.user._id,
      receiverId,
      type,
      content,
      delivered: true,
    });

    const populated = await message.populate(['senderId', 'receiverId']);

    return res.status(201).json({ message: populated });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/messages/:roomId/read — mark messages as read
export const markRead = async (req, res) => {
  try {
    const { roomId } = req.params;

    await Message.updateMany(
      { roomId, receiverId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('markRead error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
