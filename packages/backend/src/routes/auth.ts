import { Hono } from 'hono';
import { z } from 'zod';
import { getOne, run } from '../db';
import {
  generateToken,
  extractToken,
  generateRefreshTokenValue,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../auth';
import { hashPassword, verifyPassword } from '../crypto';
import { logger } from '../logger';
import { sendWelcomeEmail } from '../services/email';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  AuthorizationError,
  isAppError,
} from '../error';

async function issueSession(user: { id: string; email: string; role: string }) {
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role as 'seller' | 'buyer' | 'admin',
  });

  const refreshToken = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await run(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashRefreshToken(refreshToken), expiresAt]
  );

  return { token, refreshToken };
}

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

    const { token, refreshToken } = await issueSession(user);

    sendWelcomeEmail(user.email, user.name).catch((err) =>
      logger.error('Failed to send welcome email', err, { userId: user.id })
    );

    return c.json({ user, token, refreshToken }, 201);
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

    const { token, refreshToken } = await issueSession(user);

    return c.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
      refreshToken,
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

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /api/auth/refresh - exchange a valid refresh token for a new access token
// Rotates the refresh token (old one is revoked) to limit replay if leaked.
app.post('/refresh', async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = RefreshSchema.parse(body);

    const tokenHash = hashRefreshToken(refreshToken);
    const record = await getOne<{ id: string; user_id: string; expires_at: string }>(
      `SELECT id, user_id, expires_at FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );

    if (!record || new Date(record.expires_at) <= new Date()) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const user = await getOne(
      'SELECT id, email, name, role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [record.user_id]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    await run('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);

    const session = await issueSession(user);

    logger.info('Access token refreshed', { userId: user.id });

    return c.json(session);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new ValidationError('Invalid input', err.flatten().fieldErrors);
    }
    if (isAppError(err)) throw err;
    logger.error('Refresh error', err);
    throw err;
  }
});

// POST /api/auth/logout - revoke a refresh token
app.post('/logout', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = RefreshSchema.safeParse(body);

    if (parsed.success) {
      await run(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
        [hashRefreshToken(parsed.data.refreshToken)]
      );
    }

    return c.json({ success: true });
  } catch (err) {
    logger.error('Logout error', err);
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
