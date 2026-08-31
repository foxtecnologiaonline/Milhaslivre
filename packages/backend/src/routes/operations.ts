import { Hono } from 'hono';
import { z } from 'zod';
import { getMany, getOne, run, query } from '../db';
import { extractToken, requireAuth } from '../auth';

const app = new Hono();

const OperationSchema = z.object({
  program: z.string().min(1),
  amount: z.number().int().positive(),
  pricePerThousand: z.number().positive(),
  commissionPercentage: z.number().min(0).max(100),
});

const ConfirmOperationSchema = z.object({
  buyerId: z.string().uuid(),
});

// GET /api/operations - list operations (protected)
app.get('/', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const operations = await getMany(
      `SELECT * FROM operations
       WHERE seller_id = $1 OR buyer_id = $1 OR $2 = 'admin'
       ORDER BY created_at DESC LIMIT 100`,
      [token.userId, token.role]
    );

    return c.json(operations);
  } catch (err) {
    return c.json({ error: 'Failed to fetch operations' }, 500);
  }
});

// POST /api/operations - create operation (protected)
app.post('/', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const validated = OperationSchema.parse(body);

    const operation = await getOne(
      `INSERT INTO operations (
        seller_id, program, amount, price_per_thousand, commission_percentage, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [
        token.userId,
        validated.program,
        validated.amount,
        validated.pricePerThousand,
        validated.commissionPercentage,
      ]
    );

    return c.json(operation, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    return c.json({ error: 'Failed to create operation' }, 500);
  }
});

// POST /api/operations/:id/confirm - confirm operation (protected)
app.post('/:id/confirm', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const validated = ConfirmOperationSchema.parse(body);

    // Get operation
    const operation = await getOne(
      `SELECT * FROM operations WHERE id = $1`,
      [id]
    );

    if (!operation) {
      return c.json({ error: 'Operation not found' }, 404);
    }

    if (operation.status !== 'pending') {
      return c.json({ error: 'Operation already confirmed or cancelled' }, 400);
    }

    // Update operation
    const updated = await getOne(
      `UPDATE operations SET buyer_id = $1, status = 'confirmed', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [validated.buyerId, id]
    );

    // Create transaction record
    await run(
      `INSERT INTO transactions (operation_id, amount, commission_amount, status)
       VALUES ($1, $2, $3, 'pending')`,
      [id, updated.total_price, updated.commission_amount]
    );

    return c.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    return c.json({ error: 'Failed to confirm operation' }, 500);
  }
});

// GET /api/operations/stats - dashboard stats (protected)
app.get('/stats', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const isAdmin = token.role === 'admin';
    const userId = token.userId;

    const result = await getOne(
      `SELECT
        COUNT(*) as total_operations,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_operations,
        SUM(CASE WHEN status = 'completed' THEN commission_amount ELSE 0 END) as total_commission,
        SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END) as total_volume
       FROM operations
       WHERE ${isAdmin ? '1=1' : 'seller_id = $1 OR buyer_id = $1'}`,
      isAdmin ? [] : [userId]
    );

    return c.json(result);
  } catch (err) {
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
