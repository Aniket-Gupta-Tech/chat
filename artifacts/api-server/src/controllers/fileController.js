import path from 'path';
import fs from 'fs';
import File from '../models/File.js';
import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';
import { uploadDir } from '../middleware/upload.js';
import { getIO } from '../services/socketService.js';

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

const detectType = (mimeType) => {
  if (IMAGE_MIMES.includes(mimeType)) return 'image';
  if (VIDEO_MIMES.includes(mimeType)) return 'video';
  return 'file';
};

// POST /api/files/upload/:roomId
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { roomId } = req.params;
    const { receiverId } = req.body;

    if (!receiverId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'receiverId is required' });
    }

    const room = await ChatRoom.findOne({ roomId, active: true });
    if (!room) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Room not found or has ended' });
    }

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Not authorized' });
    }

    const otherParticipant = room.participants.find((p) => !p.equals(req.user._id));
    if (!otherParticipant || otherParticipant.toString() !== receiverId) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Invalid receiverId' });
    }

    const type = detectType(req.file.mimetype);

    const fileRecord = await File.create({
      roomId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user._id,
    });

    const messageContent = JSON.stringify({
      fileId: fileRecord._id,
      filename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    const message = await Message.create({
      roomId,
      senderId: req.user._id,
      receiverId: otherParticipant,
      type,
      content: messageContent,
      delivered: true,
    });

    await message.populate([
      { path: 'senderId', select: 'username' },
      { path: 'receiverId', select: 'username' },
    ]);

    const msgObj = message.toObject();

    const io = getIO();
    if (io) {
      io.to(roomId).emit('new_message', msgObj);
      io.to(`user:${receiverId}`).emit('message_notification', { roomId, message: msgObj });
    }

    return res.status(201).json({ file: fileRecord, message: msgObj });
  } catch (err) {
    console.error('uploadFile error:', err);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/files/:fileId/download
export const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const room = await ChatRoom.findOne({ roomId: file.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    if (!fs.existsSync(file.filepath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimeType);
    return res.sendFile(path.resolve(file.filepath));
  } catch (err) {
    console.error('downloadFile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/files/:fileId/view  — inline (images, videos)
export const viewFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const room = await ChatRoom.findOne({ roomId: file.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    if (!fs.existsSync(file.filepath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(path.resolve(file.filepath));
  } catch (err) {
    console.error('viewFile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/files/room/:roomId
export const getRoomFiles = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await ChatRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some((p) => p.equals(req.user._id));
    if (!isParticipant) return res.status(403).json({ error: 'Not authorized' });

    const files = await File.find({ roomId })
      .populate('uploadedBy', 'username')
      .sort({ createdAt: -1 });

    return res.json({ files });
  } catch (err) {
    console.error('getRoomFiles error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
