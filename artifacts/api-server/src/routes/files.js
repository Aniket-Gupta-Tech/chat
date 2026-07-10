import { Router } from 'express';
import { uploadFile, downloadFile, viewFile, getRoomFiles } from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.post('/upload/:roomId', upload.single('file'), uploadFile);
router.get('/room/:roomId', getRoomFiles);
router.get('/:fileId/download', downloadFile);
router.get('/:fileId/view', viewFile);

export default router;
