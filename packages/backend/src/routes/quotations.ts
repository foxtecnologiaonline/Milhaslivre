import { Hono } from 'hono';
import { z } from 'zod';
import { getMany, getOne, run } from '../db';

const app = new Hono();

const QuotationSchema = z.object({
  program: z.string().min(1),
  amount: z.number().int().positive(),
});

// GET /api/quotations - list available quotations
app.get('/', async (c) => {
  try {
    const quotations = await getMany(
      `SELECT * FROM quotations WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 100`
    );
    return c.json(quotations);
  } catch (err) {
    return c.json({ error: 'Failed to fetch quotations' }, 500);
  }
});

// POST /api/quotations - create a new quotation
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = QuotationSchema.parse(body);

    const quotation = await getOne(
      `INSERT INTO quotations (program, amount, price_per_thousand, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
       RETURNING *`,
      [validated.program, validated.amount, validated.amount > 50000 ? 45 : 50]
    );

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
    const quotation = await getOne(
      `SELECT * FROM quotations WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );

    if (!quotation) {
      return c.json({ error: 'Quotation not found or expired' }, 404);
    }

    return c.json(quotation);
  } catch (err) {
    return c.json({ error: 'Failed to fetch quotation' }, 500);
  }
});

export default app;
