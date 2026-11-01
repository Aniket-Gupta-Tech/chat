import express, { Router } from 'express';
import {
  uploadFile, downloadFile, viewFile, getRoomFiles,
  initUpload, uploadStatus, uploadChunk, completeUpload, cancelUpload,
} from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';
import { upload, CHUNK_SIZE } from '../middleware/upload.js';

const router = Router();

router.use(protect);

// Resumable chunked upload
router.post('/upload/:roomId/init', initUpload);
router.get('/upload/:uploadId/status', uploadStatus);
router.put(
  '/upload/:uploadId/chunk',
  express.raw({ type: 'application/octet-stream', limit: CHUNK_SIZE + 1024 }),
  uploadChunk,
);
router.post('/upload/:uploadId/complete', completeUpload);
router.delete('/upload/:uploadId', cancelUpload);

// Single-request upload (kept for compatibility)
router.post('/upload/:roomId', upload.single('file'), uploadFile);
router.get('/room/:roomId', getRoomFiles);
router.get('/:fileId/download', downloadFile);
router.get('/:fileId/view', viewFile);

export default router;
