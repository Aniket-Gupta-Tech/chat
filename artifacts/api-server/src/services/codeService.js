import bcrypt from 'bcryptjs';

const CODE_EXPIRY_SECONDS = 60;
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a random 2-digit code (10–99)
 */
export const generateCode = () => {
  return String(Math.floor(10 + Math.random() * 90));
};

/**
 * Hash a code for safe storage
 */
export const hashCode = async (code) => {
  return bcrypt.hash(code, 10);
};

/**
 * Compare a plain code with its hash
 */
export const verifyCode = async (plain, hash) => {
  return bcrypt.compare(String(plain), hash);
};

/**
 * Calculate expiry timestamp
 */
export const getExpiryTime = () => {
  return new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000);
};

export { CODE_EXPIRY_SECONDS, MAX_ATTEMPTS, BLOCK_DURATION_MS };
