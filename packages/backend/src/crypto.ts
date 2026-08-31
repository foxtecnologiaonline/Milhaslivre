// Password hashing utilities (for Node.js backend)
// Note: For Cloudflare Workers, use a REST API alternative like Supabase Auth

import crypto from 'crypto';

// Simple password hashing (PBKDF2 for compatibility)
// In production, use bcrypt or argon2
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(':');
  if (!salt || !storedHash) return false;

  const computedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');

  return computedHash === storedHash;
}

export function generateVerificationCode(): string {
  return crypto.randomBytes(32).toString('hex');
}
