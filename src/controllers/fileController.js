import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import File from '../models/File.js';
import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';
import { uploadDir, tmpUploadDir, MAX_FILE_SIZE, CHUNK_SIZE, validateFileMeta } from '../middleware/upload.js';
import { getIO } from '../services/socketService.js';

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

const detectType = (mimeType) => {
  if (IMAGE_MIMES.includes(mimeType)) return 'image';
  if (VIDEO_MIMES.includes(mimeType)) return 'video';
  return 'file';
};

// Creates the File + Message records and pushes the message to both participants
const saveFileAndNotify = async ({ roomId, senderId, receiverId, filename, originalName, filepath, fileSize, mimeType }) => {
  const fileRecord = await File.create({
    roomId,
    filename,
    originalName,
    filepath,
    fileSize,
    mimeType,
    uploadedBy: senderId,
  });

  const message = await Message.create({
    roomId,
    senderId,
    receiverId,
    type: detectType(mimeType),
    content: JSON.stringify({ fileId: fileRecord._id, filename: originalName, fileSize, mimeType }),
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
    io.to(`user:${receiverId.toString()}`).emit('message_notification', { roomId, message: msgObj });
  }

  return { file: fileRecord, message: msgObj };
};

// Checks the room is active, the user is in it and receiverId is the other participant.
// Returns { room, otherParticipant } or { status, error }.
const checkRoomAccess = async (roomId, user, receiverId) => {
  const room = await ChatRoom.findOne({ roomId, active: true });
  if (!room) return { status: 404, error: 'Room not found or has ended' };

  if (!room.participants.some((p) => p.equals(user._id))) return { status: 403, error: 'Not authorized' };

  const otherParticipant = room.participants.find((p) => !p.equals(user._id));
  if (!otherParticipant || otherParticipant.toString() !== receiverId) {
    return { status: 403, error: 'Invalid receiverId' };
  }
  return { room, otherParticipant };
};

// ── Resumable chunked upload ────────────────────────────────────────────────
// Each upload lives in uploads/tmp as <id>.part (data) + <id>.json (metadata),
// so an interrupted upload can resume from the bytes already on disk, even after a server restart.

const UPLOAD_ID_RE = /^[0-9a-f-]{36}$/;
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const partPath = (id) => path.join(tmpUploadDir, `${id}.part`);
const metaPath = (id) => path.join(tmpUploadDir, `${id}.json`);

const readMeta = async (id, user) => {
  if (!UPLOAD_ID_RE.test(id)) return null;
  try {
    const meta = JSON.parse(await fsp.readFile(metaPath(id), 'utf8'));
    return meta.userId === user._id.toString() ? meta : null;
  } catch {
    return null;
  }
};

const receivedBytes = async (id) => {
  try {
    return (await fsp.stat(partPath(id))).size;
  } catch {
    return 0;
  }
};

const removeUpload = async (id) => {
  await Promise.all([fsp.rm(partPath(id), { force: true }), fsp.rm(metaPath(id), { force: true })]);
};

const purgeStaleUploads = async () => {
  try {
    const now = Date.now();
    for (const name of await fsp.readdir(tmpUploadDir)) {
      const full = path.join(tmpUploadDir, name);
      const { mtimeMs } = await fsp.stat(full);
      if (now - mtimeMs > STALE_UPLOAD_MS) await fsp.rm(full, { force: true });
    }
  } catch (err) {
    console.error('purgeStaleUploads error:', err);
  }
};

// POST /api/files/upload/:roomId/init  { filename, fileSize, mimeType, receiverId }
export const initUpload = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { filename, mimeType, receiverId } = req.body;
    const fileSize = Number(req.body.fileSize);

    if (!filename || !mimeType || !receiverId) {
      return res.status(400).json({ error: 'filename, mimeType and receiverId are required' });
    }
    if (!Number.isInteger(fileSize) || fileSize <= 0) return res.status(400).json({ error: 'Invalid fileSize' });
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(413).json({ error: `File too large. Max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB` });
    }

    const typeError = validateFileMeta(filename, mimeType);
    if (typeError) return res.status(400).json({ error: typeError });

    const access = await checkRoomAccess(roomId, req.user, receiverId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    purgeStaleUploads();

    const uploadId = crypto.randomUUID();
    const meta = {
      uploadId,
      roomId,
      receiverId,
      userId: req.user._id.toString(),
      originalName: path.basename(filename),
      mimeType,
      fileSize,
    };
    await fsp.writeFile(partPath(uploadId), '');
    await fsp.writeFile(metaPath(uploadId), JSON.stringify(meta));

    return res.status(201).json({ uploadId, chunkSize: CHUNK_SIZE, received: 0 });
  } catch (err) {
    console.error('initUpload error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/files/upload/:uploadId/status
export const uploadStatus = async (req, res) => {
  const meta = await readMeta(req.params.uploadId, req.user);
  if (!meta) return res.status(404).json({ error: 'Upload not found' });
  return res.json({ received: await receivedBytes(meta.uploadId), fileSize: meta.fileSize });
};

// PUT /api/files/upload/:uploadId/chunk?offset=N   (body: raw bytes)
// Chunks are appended only when offset matches the bytes already stored, so a retried
// chunk is never written twice; a mismatch returns 409 with the correct offset.
export const uploadChunk = async (req, res) => {
  try {
    const meta = await readMeta(req.params.uploadId, req.user);
    if (!meta) return res.status(404).json({ error: 'Upload not found' });

    const offset = Number(req.query.offset);
    const received = await receivedBytes(meta.uploadId);
    if (offset !== received) return res.status(409).json({ error: 'Offset mismatch', received });

    const chunk = req.body;
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) return res.status(400).json({ error: 'Empty chunk' });
    if (received + chunk.length > meta.fileSize) return res.status(400).json({ error: 'Chunk exceeds file size' });

    await fsp.appendFile(partPath(meta.uploadId), chunk);
    return res.json({ received: received + chunk.length });
  } catch (err) {
    console.error('uploadChunk error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/files/upload/:uploadId/complete
export const completeUpload = async (req, res) => {
  try {
    const meta = await readMeta(req.params.uploadId, req.user);
    if (!meta) return res.status(404).json({ error: 'Upload not found' });

    const received = await receivedBytes(meta.uploadId);
    if (received !== meta.fileSize) {
      return res.status(409).json({ error: 'Upload incomplete', received });
    }

    const access = await checkRoomAccess(meta.roomId, req.user, meta.receiverId);
    if (access.error) {
      await removeUpload(meta.uploadId);
      return res.status(access.status).json({ error: access.error });
    }

    const ext = path.extname(meta.originalName).toLowerCase();
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const finalPath = path.join(uploadDir, filename);
    await fsp.rename(partPath(meta.uploadId), finalPath);
    await fsp.rm(metaPath(meta.uploadId), { force: true });

    const result = await saveFileAndNotify({
      roomId: meta.roomId,
      senderId: req.user._id,
      receiverId: access.otherParticipant,
      filename,
      originalName: meta.originalName,
      filepath: finalPath,
      fileSize: meta.fileSize,
      mimeType: meta.mimeType,
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error('completeUpload error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/files/upload/:uploadId
export const cancelUpload = async (req, res) => {
  const meta = await readMeta(req.params.uploadId, req.user);
  if (meta) await removeUpload(meta.uploadId);
  return res.status(204).end();
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

    const result = await saveFileAndNotify({
      roomId,
      senderId: req.user._id,
      receiverId: otherParticipant,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    return res.status(201).json(result);
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
