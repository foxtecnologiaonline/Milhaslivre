// Redis client with graceful degradation: if REDIS_URL is unset or the
// connection fails, callers fall back to their own in-memory behavior instead
// of crashing the request.
import { createClient } from 'redis';
import { logger } from './logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;

async function connect(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const instance = createClient({ url });
  instance.on('error', (err) => logger.warn('Redis client error', { error: err.message }));

  try {
    await instance.connect();
    logger.info('Redis connected');
    return instance;
  } catch (err) {
    logger.warn('Redis connection failed, falling back to in-memory', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function getRedis(): Promise<RedisClient | null> {
  if (client) return client;
  if (!connectPromise) {
    connectPromise = connect().then((instance) => {
      client = instance;
      return instance;
    });
  }
  return connectPromise;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    connectPromise = null;
  }
}
