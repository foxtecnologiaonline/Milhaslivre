// Rate limiting middleware. Uses Redis (INCR + EXPIRE) when available so
// limits are shared across instances; falls back to an in-memory Map
// (single-instance only) when Redis is not configured or unreachable.
import { Context } from 'hono';
import { logger } from '../logger';
import { RateLimitError } from '../error';
import { getRedis } from '../redis';

interface RateLimitConfig {
  windowMs: number; // Time window in ms
  maxRequests: number; // Max requests per window
}

const defaultConfig: Record<string, RateLimitConfig> = {
  auth: { windowMs: 60000, maxRequests: 5 }, // 5 per minute
  api: { windowMs: 60000, maxRequests: 100 }, // 100 per minute
  webhook: { windowMs: 1000, maxRequests: 10 }, // 10 per second
};

// In-memory fallback store
const store = new Map<string, { count: number; resetTime: number }>();

async function incrementInMemory(
  key: string,
  windowMs: number
): Promise<{ count: number; resetTime: number }> {
  const now = Date.now();
  let record = store.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  record.count++;
  store.set(key, record);
  return record;
}

async function incrementInRedis(
  key: string,
  windowMs: number
): Promise<{ count: number; resetTime: number } | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pExpire(key, windowMs);
    }
    const ttl = await redis.pTTL(key);
    return { count, resetTime: Date.now() + (ttl > 0 ? ttl : windowMs) };
  } catch (err) {
    logger.warn('Redis rate limit increment failed, falling back to in-memory', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function createRateLimiter(type: 'auth' | 'api' | 'webhook' = 'api') {
  const config = defaultConfig[type];

  return async (c: Context, next: () => Promise<void>) => {
    const identifier = getIdentifier(c);
    const key = `ratelimit:${type}:${identifier}`;

    const record =
      (await incrementInRedis(key, config.windowMs)) ??
      (await incrementInMemory(key, config.windowMs));

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
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - record.count)));
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

// Cleanup old in-memory entries (only relevant when Redis is unavailable)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 60000); // Every minute
