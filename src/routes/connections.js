import { Router } from 'express';
import { createRequest, verifyRequest, rejectRequest } from '../controllers/connectionController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.post('/request', createRequest);
router.post('/verify', verifyRequest);
router.post('/reject', rejectRequest);

export default router;
