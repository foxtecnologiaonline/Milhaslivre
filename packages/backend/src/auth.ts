import { encode, decode } from 'jwt-simple';
import { Context } from 'hono';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'seller' | 'buyer' | 'admin';
  iat: number;
}

export function generateToken(payload: Omit<JWTPayload, 'iat'>): string {
  return encode(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    'HS256'
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return decode(token, JWT_SECRET, true, 'HS256') as JWTPayload;
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
