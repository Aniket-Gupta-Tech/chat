import User from '../models/User.js';
import { sanitizeUser } from '../utils/helpers.js';

// GET /api/users/search?q=username
export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id },
    })
      .select('username onlineStatus lastSeen')
      .limit(20);

    return res.json({ users: users.map(sanitizeUser) });
  } catch (err) {
    console.error('searchUsers error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/users/:id
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username onlineStatus lastSeen');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('getUser error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/users
export const getOnlineUsers = async (req, res) => {
  try {
    const users = await User.find({
      onlineStatus: true,
      _id: { $ne: req.user._id },
    }).select('username onlineStatus lastSeen').limit(50);

    return res.json({ users: users.map(sanitizeUser) });
  } catch (err) {
    console.error('getOnlineUsers error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
