// Integration tests for auth routes, exercised via Hono's app.request() with
// the database layer mocked so no live Postgres is required.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db', () => ({
  getOne: vi.fn(),
  getMany: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../src/services/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(false),
  sendOperationConfirmedEmail: vi.fn().mockResolvedValue(false),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(false),
}));

const { getOne, run } = await import('../src/db');
const authRoutesRaw = (await import('../src/routes/auth')).default;
const { verifyToken } = await import('../src/auth');
const { withErrorHandling } = await import('./helpers');

const authRoutes = withErrorHandling(authRoutesRaw);

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return authRoutes.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validRegisterBody = {
  email: 'seller@example.com',
  name: 'João Silva',
  cpf: '11144477735',
  phone: '11999999999',
  role: 'seller' as const,
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
};

describe('POST /register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects mismatched passwords with a validation error', async () => {
    const res = await jsonRequest('/register', {
      ...validRegisterBody,
      confirmPassword: 'DifferentPass1!',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration when the email already exists', async () => {
    vi.mocked(getOne).mockResolvedValueOnce({ id: 'existing-user' });

    const res = await jsonRequest('/register', validRegisterBody);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONFLICT');
  });

  it('creates a user, issues a session and stores a hashed refresh token', async () => {
    vi.mocked(getOne)
      .mockResolvedValueOnce(null) // email uniqueness check
      .mockResolvedValueOnce({
        id: 'user-1',
        email: validRegisterBody.email,
        name: validRegisterBody.name,
        role: validRegisterBody.role,
      });

    const res = await jsonRequest('/register', validRegisterBody);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.id).toBe('user-1');
    expect(typeof body.token).toBe('string');
    expect(typeof body.refreshToken).toBe('string');

    const payload = verifyToken(body.token);
    expect(payload?.userId).toBe('user-1');
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO refresh_tokens'),
      expect.arrayContaining(['user-1'])
    );
  });
});

describe('POST /login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid credentials without leaking whether the user exists', async () => {
    vi.mocked(getOne).mockResolvedValueOnce(null);

    const res = await jsonRequest('/login', {
      email: 'nobody@example.com',
      password: 'whatever',
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unknown or revoked refresh token', async () => {
    vi.mocked(getOne).mockResolvedValueOnce(null);

    const res = await jsonRequest('/refresh', { refreshToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
  });

  it('rotates a valid refresh token and issues a new session', async () => {
    vi.mocked(getOne)
      .mockResolvedValueOnce({
        id: 'rt-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'seller@example.com',
        name: 'João Silva',
        role: 'seller',
      });

    const res = await jsonRequest('/refresh', { refreshToken: 'a-valid-token' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(typeof body.refreshToken).toBe('string');

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('SET revoked_at = NOW()'),
      ['rt-1']
    );
  });
});
