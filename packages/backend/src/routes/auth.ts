import { Hono } from 'hono';
import { z } from 'zod';
import { getOne, run } from '../db';
import { generateToken, extractToken } from '../auth';

const app = new Hono();

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  cpf: z.string().regex(/^\d{11}$/),
  phone: z.string().min(10),
  role: z.enum(['seller', 'buyer']),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register
app.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validated = RegisterSchema.parse(body);

    // Check if user exists
    const existing = await getOne(
      'SELECT id FROM users WHERE email = $1',
      [validated.email]
    );

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    // Create user (in production, use bcrypt for password)
    const user = await getOne(
      `INSERT INTO users (email, name, cpf, phone, role, password_hash, verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id, email, name, role`,
      [
        validated.email,
        validated.name,
        validated.cpf,
        validated.phone,
        validated.role,
        validated.password, // TODO: hash with bcrypt in production
      ]
    );

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({ user, token }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// POST /api/auth/login
app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validated = LoginSchema.parse(body);

    const user = await getOne(
      `SELECT id, email, name, role, password_hash
       FROM users WHERE email = $1`,
      [validated.email]
    );

    if (!user || user.password_hash !== validated.password) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    return c.json({ error: 'Login failed' }, 500);
  }
});

// GET /api/auth/me - get current user (protected)
app.get('/me', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    id: token.userId,
    email: token.email,
    role: token.role,
  });
});

export default app;
