import User from '../models/User.js';

export const registerPresenceHandlers = (io, socket) => {
  const user = socket.user;

  const setOnline = async () => {
    try {
      await User.findByIdAndUpdate(user._id, {
        onlineStatus: true,
        lastSeen: new Date(),
      });
      io.emit('user_online', { userId: user._id, username: user.username });
    } catch (err) {
      console.error('setOnline error:', err);
    }
  };

  const setOffline = async () => {
    try {
      await User.findByIdAndUpdate(user._id, {
        onlineStatus: false,
        lastSeen: new Date(),
      });
      io.emit('user_offline', {
        userId: user._id,
        username: user.username,
        lastSeen: new Date(),
      });
    } catch (err) {
      console.error('setOffline error:', err);
    }
  };

  setOnline();

  socket.on('disconnect', setOffline);
};
