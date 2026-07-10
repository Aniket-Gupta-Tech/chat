import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import connectDB from './config/db.js';
import apiRoutes from './routes/index.js';
import { initSocket } from './sockets/index.js';
import { setIO } from './services/socketService.js';
import { startCleanupService } from './services/cleanupService.js';

const PORT = process.env.PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || '*';

await connectDB();

const app = express();
const httpServer = http.createServer(app);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize());

app.use('/api', apiRoutes);

app.use('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found' }));

const io = initSocket(httpServer);
setIO(io);

startCleanupService();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO path: /api/socket.io`);
});

export default app;
