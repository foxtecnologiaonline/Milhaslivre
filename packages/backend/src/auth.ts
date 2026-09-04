import { encode, decode } from 'jwt-simple';
import { Context } from 'hono';
import crypto from 'crypto';
import { getConfig } from './config';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'seller' | 'buyer' | 'admin';
  iat: number;
  exp: number;
}

// Parses durations like '24h', '30d', '15m', '45s'. Falls back to seconds if a bare number is given.
export function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(value.trim());
  if (!match) return 24 * 60 * 60; // default 24h

  const amount = Number(match[1]);
  const unit = match[2] || 's';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const { JWT_SECRET, JWT_EXPIRY } = getConfig();
  const now = Math.floor(Date.now() / 1000);

  return encode(
    { ...payload, iat: now, exp: now + parseDuration(JWT_EXPIRY) },
    JWT_SECRET,
    'HS256'
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const { JWT_SECRET } = getConfig();
    const payload = decode(token, JWT_SECRET, false, 'HS256') as JWTPayload;

    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      return null; // expired
    }

    return payload;
  } catch {
    return null;
  }
}

export async function extractToken(c: Context): Promise<JWTPayload | null> {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return verifyToken(token);
}

export function requireAuth(c: Context) {
  return async (next: () => Promise<void>) => {
    const token = await extractToken(c);
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', token);
    await next();
  };
}

// Refresh tokens are opaque random strings, stored hashed in the DB so they can be
// looked up, rotated and revoked without needing to decode a JWT.
export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
