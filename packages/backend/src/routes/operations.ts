import { Hono } from 'hono';
import { z } from 'zod';
import { getMany, getOne, run, transaction } from '../db';
import { extractToken } from '../auth';
import { logger } from '../logger';
import { notifyOperationCreated, notifyOperationConfirmed } from '../services/twilio';
import { sendOperationConfirmedEmail } from '../services/email';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  isAppError,
} from '../error';

const app = new Hono();

const OperationSchema = z.object({
  program: z.enum(['smiles', 'latampass', 'azulconnect', 'viceversa']),
  amount: z.number().int().min(1000, 'Minimum 1000 points'),
  pricePerThousand: z.number().positive('Price must be positive'),
  commissionPercentage: z.number().min(0).max(100),
});

const ConfirmOperationSchema = z.object({
  buyerId: z.string().uuid(),
});

// GET /api/operations - list operations (protected)
app.get('/', async (c) => {
  try {
    const token = await extractToken(c);
    if (!token) {
      throw new AuthenticationError();
    }

    const operations = await getMany(
      `SELECT * FROM operations
       WHERE (seller_id = $1 OR buyer_id = $1 OR $2 = 'admin')
       AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 100`,
      [token.userId, token.role]
    );

    logger.debug('Operations fetched', { count: operations.length, userId: token.userId });
    return c.json(operations);
  } catch (err) {
    if (isAppError(err)) throw err;
    logger.error('Failed to fetch operations', err);
    throw err;
  }
});

// POST /api/operations - create operation (protected)
app.post('/', async (c) => {
  try {
    const token = await extractToken(c);
    if (!token) {
      throw new AuthenticationError();
    }

    const body = await c.req.json();
    const validated = OperationSchema.parse(body);

    // Verify user is seller
    const user = await getOne<{ role: string; phone: string }>(
      'SELECT role, phone FROM users WHERE id = $1',
      [token.userId]
    );
    if (!user || user.role !== 'seller') {
      throw new ConflictError('Only sellers can create operations');
    }

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

    logger.info('Operation created', { operationId: operation.id, sellerId: token.userId });

    if (user.phone) {
      notifyOperationCreated(user.phone, operation.id, validated.amount).catch((err) =>
        logger.error('Failed to notify operation creation', err, { operationId: operation.id })
      );
    }

    return c.json(operation, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError('Invalid input', err.flatten().fieldErrors);
    }
    if (isAppError(err)) throw err;
    logger.error('Failed to create operation', err);
    throw err;
  }
});

// POST /api/operations/:id/confirm - confirm operation (protected)
app.post('/:id/confirm', async (c) => {
  try {
    const token = await extractToken(c);
    if (!token) {
      throw new AuthenticationError();
    }

    const { id } = c.req.param();
    const body = await c.req.json();
    const validated = ConfirmOperationSchema.parse(body);

    // Get operation
    const operation = await getOne(
      `SELECT * FROM operations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (!operation) {
      throw new NotFoundError('Operation');
    }

    if (operation.status !== 'pending') {
      throw new ConflictError('Operation cannot be confirmed in current status');
    }

    // Use transaction for atomicity
    const updated = await transaction(async (client) => {
      // Update operation
      const result = await client.query(
        `UPDATE operations SET buyer_id = $1, status = 'confirmed', updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [validated.buyerId, id]
      );

      const op = result.rows[0];

      // Create transaction record
      await client.query(
        `INSERT INTO transactions (operation_id, amount, commission_amount, status)
         VALUES ($1, $2, $3, 'pending')`,
        [id, op.total_price, op.commission_amount]
      );

      return op;
    });

    logger.info('Operation confirmed', {
      operationId: id,
      buyerId: validated.buyerId,
      amount: operation.amount,
    });

    const [seller, buyer] = await Promise.all([
      getOne<{ email: string; phone: string }>('SELECT email, phone FROM users WHERE id = $1', [
        operation.seller_id,
      ]),
      getOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [validated.buyerId]),
    ]);

    if (seller && buyer) {
      notifyOperationConfirmed(seller.phone, id, buyer.name).catch((err) =>
        logger.error('Failed to notify operation confirmation', err, { operationId: id })
      );
      sendOperationConfirmedEmail(seller.email, id, buyer.name).catch((err) =>
        logger.error('Failed to send operation confirmed email', err, { operationId: id })
      );
    }

    return c.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError('Invalid input', err.flatten().fieldErrors);
    }
    if (isAppError(err)) throw err;
    logger.error('Failed to confirm operation', err);
    throw err;
  }
});

// GET /api/operations/stats - dashboard stats (protected)
app.get('/stats', async (c) => {
  try {
    const token = await extractToken(c);
    if (!token) {
      throw new AuthenticationError();
    }

    const isAdmin = token.role === 'admin';
    const userId = token.userId;

    const result = await getOne(
      `SELECT
        COUNT(*) as total_operations,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_operations,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN commission_amount ELSE 0 END), 0) as total_commission,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END), 0) as total_volume
       FROM operations
       WHERE (${isAdmin ? '1=1' : 'seller_id = $1 OR buyer_id = $1'})
       AND deleted_at IS NULL`,
      isAdmin ? [] : [userId]
    );

    return c.json(result || {});
  } catch (err) {
    if (isAppError(err)) throw err;
    logger.error('Failed to fetch stats', err);
    throw err;
  }
});

export default app;
