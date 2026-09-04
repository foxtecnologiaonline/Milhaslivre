import { Hono } from 'hono';
import { z } from 'zod';
import { getMany, getOne } from '../db';
import { getRedis } from '../redis';
import { logger } from '../logger';

const app = new Hono();

const QUOTATION_TTL_SECONDS = 15 * 60;
const LIST_CACHE_TTL_SECONDS = 10;

const QuotationSchema = z.object({
  program: z.string().min(1),
  amount: z.number().int().positive(),
});

async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    logger.warn('Redis cache read failed', { key, error: (err as Error).message });
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn('Redis cache write failed', { key, error: (err as Error).message });
  }
}

// GET /api/quotations - list available quotations (short-lived cache to absorb bursts)
app.get('/', async (c) => {
  try {
    const cacheKey = 'quotations:list';
    const cached = await cacheGet(cacheKey);
    if (cached) {
      c.header('X-Cache', 'HIT');
      return c.json(cached);
    }

    const quotations = await getMany(
      `SELECT * FROM quotations WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 100`
    );

    await cacheSet(cacheKey, quotations, LIST_CACHE_TTL_SECONDS);
    c.header('X-Cache', 'MISS');
    return c.json(quotations);
  } catch (err) {
    return c.json({ error: 'Failed to fetch quotations' }, 500);
  }
});

// POST /api/quotations - create a new quotation (cached for its 15-minute validity window)
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = QuotationSchema.parse(body);

    const quotation = await getOne<{ id: string }>(
      `INSERT INTO quotations (program, amount, price_per_thousand, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
       RETURNING *`,
      [validated.program, validated.amount, validated.amount > 50000 ? 45 : 50]
    );

    if (quotation) {
      await cacheSet(`quotation:${quotation.id}`, quotation, QUOTATION_TTL_SECONDS);
    }

    return c.json(quotation, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    return c.json({ error: 'Failed to create quotation' }, 500);
  }
});

// GET /api/quotations/:id
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const cacheKey = `quotation:${id}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      c.header('X-Cache', 'HIT');
      return c.json(cached);
    }

    const quotation = await getOne(
      `SELECT * FROM quotations WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );

    if (!quotation) {
      return c.json({ error: 'Quotation not found or expired' }, 404);
    }

    await cacheSet(cacheKey, quotation, QUOTATION_TTL_SECONDS);
    c.header('X-Cache', 'MISS');
    return c.json(quotation);
  } catch (err) {
    return c.json({ error: 'Failed to fetch quotation' }, 500);
  }
});

export default app;
