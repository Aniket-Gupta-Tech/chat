import jwt from 'jsonwebtoken';

export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

export const buildRoomId = (userId1, userId2) => {
  // Deterministic room ID from two user IDs
  return [userId1.toString(), userId2.toString()].sort().join('_');
};

export const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.__v;
  return obj;
};
