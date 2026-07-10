import User from '../models/User.js';
import { generateToken, sanitizeUser } from '../utils/helpers.js';

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const trimmed = username.trim();

    const exists = await User.findOne({ username: trimmed });
    if (exists) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const user = await User.create({ username: trimmed });
    const token = generateToken(user._id);

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
