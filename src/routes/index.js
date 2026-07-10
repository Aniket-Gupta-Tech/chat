import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import connectionRoutes from './connections.js';
import roomRoutes from './rooms.js';
import messageRoutes from './messages.js';
import fileRoutes from './files.js';

const router = Router();

router.get('/healthz', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/connections', connectionRoutes);
router.use('/rooms', roomRoutes);
router.use('/messages', messageRoutes);
router.use('/files', fileRoutes);

export default router;
