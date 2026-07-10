import ConnectionRequest from '../models/ConnectionRequest.js';
import ChatRoom from '../models/ChatRoom.js';
import User from '../models/User.js';
import { generateCode, hashCode, verifyCode, getExpiryTime, MAX_ATTEMPTS, BLOCK_DURATION_MS } from '../services/codeService.js';

// POST /api/connections/request
export const createRequest = async (req, res) => {
  try {
    const { receiverUsername, code } = req.body;

    if (!receiverUsername) return res.status(400).json({ error: 'receiverUsername is required' });

    const codeStr = String(code || '').trim();
    if (!/^\d{2}$/.test(codeStr)) {
      return res.status(400).json({ error: 'Code must be exactly 2 digits' });
    }

    const receiver = await User.findOne({ username: receiverUsername });
    if (!receiver) return res.status(404).json({ error: 'User not found' });
    if (receiver._id.equals(req.user._id)) return res.status(400).json({ error: 'Cannot connect with yourself' });

    // Check for existing active room
    const existingRoom = await ChatRoom.findOne({
      participants: { $all: [req.user._id, receiver._id] },
      active: true,
    });
    if (existingRoom) {
      return res.status(409).json({ error: 'Chat room already exists', roomId: existingRoom.roomId });
    }

    // Expire any old pending request
    await ConnectionRequest.updateMany(
      { senderId: req.user._id, receiverId: receiver._id, status: 'pending' },
      { status: 'expired' }
    );

    const codeHash = await hashCode(codeStr);
    const request = await ConnectionRequest.create({
      senderId: req.user._id,
      receiverId: receiver._id,
      codeHash,
      expiryTime: getExpiryTime(),
    });

    return res.status(201).json({
      requestId: request._id,
      receiverId: receiver._id,
      receiverUsername: receiver.username,
      expiresAt: request.expiryTime,
    });
  } catch (err) {
    console.error('createRequest error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/connections/verify
export const verifyRequest = async (req, res) => {
  try {
    const { requestId, code } = req.body;

    if (!requestId || !code) return res.status(400).json({ error: 'requestId and code are required' });

    const request = await ConnectionRequest.findById(requestId)
      .populate('senderId', 'username')
      .populate('receiverId', 'username');

    if (!request) return res.status(404).json({ error: 'Connection request not found' });

    // Only the receiver can verify
    if (!request.receiverId._id.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is ${request.status}` });
    }

    // Check block
    if (request.blockedUntil && request.blockedUntil > new Date()) {
      const remaining = Math.ceil((request.blockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} seconds.` });
    }

    // Check expiry
    if (request.expiryTime < new Date()) {
      await ConnectionRequest.findByIdAndUpdate(requestId, { status: 'expired' });
      return res.status(400).json({ error: 'Code has expired' });
    }

    const match = await verifyCode(String(code).trim(), request.codeHash);

    if (!match) {
      request.attempts += 1;

      if (request.attempts >= MAX_ATTEMPTS) {
        request.status = 'blocked';
        request.blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
        await request.save();
        return res.status(429).json({ error: 'Too many failed attempts. Blocked for 5 minutes.' });
      }

      await request.save();
      return res.status(400).json({
        error: 'Incorrect code',
        attemptsLeft: MAX_ATTEMPTS - request.attempts,
      });
    }

    // Code matches — create room
    request.status = 'accepted';
    await request.save();

    const room = await ChatRoom.create({
      participants: [request.senderId._id, request.receiverId._id],
    });

    return res.json({
      success: true,
      roomId: room.roomId,
      room: {
        _id: room._id,
        roomId: room.roomId,
        participants: [request.senderId, request.receiverId],
        active: room.active,
        createdAt: room.createdAt,
      },
    });
  } catch (err) {
    console.error('verifyRequest error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/connections/reject
export const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    const request = await ConnectionRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (!request.receiverId.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Only pending requests can be rejected (prevent overwriting accepted state)
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    request.status = 'rejected';
    await request.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('rejectRequest error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
