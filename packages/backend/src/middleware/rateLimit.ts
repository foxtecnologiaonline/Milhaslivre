// Rate limiting middleware
import { Context } from 'hono';
import { logger } from '../logger';
import { RateLimitError } from '../error';

interface RateLimitConfig {
  windowMs: number; // Time window in ms
  maxRequests: number; // Max requests per window
}

const defaultConfig: Record<string, RateLimitConfig> = {
  auth: { windowMs: 60000, maxRequests: 5 }, // 5 per minute
  api: { windowMs: 60000, maxRequests: 100 }, // 100 per minute
  webhook: { windowMs: 1000, maxRequests: 10 }, // 10 per second
};

// In-memory store (use Redis in production)
const store = new Map<string, { count: number; resetTime: number }>();

export function createRateLimiter(type: 'auth' | 'api' | 'webhook' = 'api') {
  const config = defaultConfig[type];

  return async (c: Context, next: () => Promise<void>) => {
    const identifier = getIdentifier(c);
    const key = `${type}:${identifier}`;

    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + config.windowMs };
      store.get(key); // Initialize
    }

    record.count++;

    if (record.count > config.maxRequests) {
      logger.warn(`Rate limit exceeded for ${identifier}`, {
        type,
        count: record.count,
        limit: config.maxRequests,
      });
      throw new RateLimitError();
    }

    // Set headers
    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(config.maxRequests - record.count));
    c.header('X-RateLimit-Reset', String(record.resetTime));

    await next();
  };
}

function getIdentifier(c: Context): string {
  // Use authorization header if available, otherwise IP
  const auth = c.req.header('authorization');
  if (auth) {
    return auth.slice(0, 20); // First 20 chars of token
  }

  return c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
}

// Cleanup old entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 60000); // Every minute
