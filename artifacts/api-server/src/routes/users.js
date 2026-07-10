import { Router } from 'express';
import { searchUsers, getUser, getOnlineUsers } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/search', searchUsers);
router.get('/online', getOnlineUsers);
router.get('/:id', getUser);

export default router;
