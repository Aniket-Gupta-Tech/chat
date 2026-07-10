import { Router } from 'express';
import { getMessages, sendMessage, markRead } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/:roomId', getMessages);
router.post('/:roomId', sendMessage);
router.patch('/:roomId/read', markRead);

export default router;
