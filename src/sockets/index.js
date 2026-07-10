import { Server } from 'socket.io';
import { verifySocketToken } from '../middleware/auth.js';
import { registerChatHandlers } from './chatHandler.js';
import { registerConnectionHandlers } from './connectionHandler.js';
import { registerPresenceHandlers } from './presenceHandler.js';

export const initSocket = (httpServer) => {
  const clientUrl = process.env.CLIENT_URL || '*';

  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    const user = await verifySocketToken(token);
    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.username} (${socket.id})`);

    // Join personal room for targeted events
    socket.join(`user:${user._id}`);

    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerConnectionHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
};
