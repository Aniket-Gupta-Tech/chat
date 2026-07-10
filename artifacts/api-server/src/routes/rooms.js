import { Router } from 'express';
import { getRooms, getRoom, endRoom } from '../controllers/roomController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getRooms);
router.get('/:roomId', getRoom);
router.post('/:roomId/end', endRoom);

export default router;
