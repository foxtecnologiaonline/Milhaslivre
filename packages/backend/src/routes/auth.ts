import { Hono } from 'hono';
import { z } from 'zod';
import { getOne, run } from '../db';
import { generateToken, extractToken } from '../auth';
import { hashPassword, verifyPassword } from '../crypto';
import { logger } from '../logger';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  AuthorizationError,
  isAppError,
} from '../error';

const app = new Hono();

// Validation schemas
const EmailSchema = z.string().email('Email inválido');
const PasswordSchema = z.string().min(8, 'Senha deve ter no mínimo 8 caracteres');
const CPFSchema = z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos');
const PhoneSchema = z.string().min(10, 'Telefone inválido');

const RegisterSchema = z.object({
  email: EmailSchema,
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpf: CPFSchema,
  phone: PhoneSchema,
  role: z.enum(['seller', 'buyer']),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords don\'t match',
  path: ['confirmPassword'],
});

const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password required'),
});

// POST /api/auth/register
app.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validated = RegisterSchema.parse(body);

    // Check if user exists
    const existing = await getOne(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [validated.email]
    );

    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create user
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
        passwordHash,
      ]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    logger.info('User registered', { userId: user.id, email: user.email });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return c.json({ user, token }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError('Invalid input', err.flatten().fieldErrors);
    }
    if (isAppError(err)) throw err;
    logger.error('Registration error', err);
    throw err;
  }
});

// POST /api/auth/login
app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validated = LoginSchema.parse(body);

    const user = await getOne(
      `SELECT id, email, name, role, password_hash
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [validated.email]
    );

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const passwordMatch = await verifyPassword(validated.password, user.password_hash);
    if (!passwordMatch) {
      logger.warn('Failed login attempt', { email: validated.email });
      throw new AuthenticationError('Invalid credentials');
    }

    logger.info('User logged in', { userId: user.id });

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
      throw new ValidationError('Invalid input', err.flatten().fieldErrors);
    }
    if (isAppError(err)) throw err;
    logger.error('Login error', err);
    throw err;
  }
});

// GET /api/auth/me - get current user (protected)
app.get('/me', async (c) => {
  const token = await extractToken(c);
  if (!token) {
    throw new AuthenticationError();
  }

  const user = await getOne(
    'SELECT id, email, name, role FROM users WHERE id = $1 AND deleted_at IS NULL',
    [token.userId]
  );

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  return c.json(user);
});

export default app;
