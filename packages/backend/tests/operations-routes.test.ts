// Integration tests for operations routes: authorization rules and the
// atomic confirm transaction, with the database layer mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db', () => ({
  getOne: vi.fn(),
  getMany: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../src/services/twilio', () => ({
  notifyOperationCreated: vi.fn().mockResolvedValue(false),
  notifyOperationConfirmed: vi.fn().mockResolvedValue(false),
  notifyOperationCompleted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../src/services/email', () => ({
  sendOperationConfirmedEmail: vi.fn().mockResolvedValue(false),
}));

const { getOne, getMany, transaction } = await import('../src/db');
const operationRoutesRaw = (await import('../src/routes/operations')).default;
const { generateToken } = await import('../src/auth');
const { withErrorHandling } = await import('./helpers');

const operationRoutes = withErrorHandling(operationRoutesRaw);

function authHeader(role: 'seller' | 'buyer' | 'admin', userId = 'user-1') {
  const token = generateToken({ userId, email: `${role}@example.com`, role });
  return { Authorization: `Bearer ${token}` };
}

function request(path: string, init: RequestInit) {
  return operationRoutes.request(path, init);
}

describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects requests without a valid token', async () => {
    const res = await request('/', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns the caller operations when authenticated', async () => {
    vi.mocked(getMany).mockResolvedValueOnce([{ id: 'op-1' }]);

    const res = await request('/', { method: 'GET', headers: authHeader('seller') });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: 'op-1' }]);
  });
});

describe('POST /', () => {
  beforeEach(() => vi.clearAllMocks());

  const validBody = {
    program: 'smiles',
    amount: 10000,
    pricePerThousand: 50,
    commissionPercentage: 5,
  };

  it('rejects buyers from creating operations', async () => {
    vi.mocked(getOne).mockResolvedValueOnce({ role: 'buyer', phone: '11999999999' });

    const res = await request('/', {
      method: 'POST',
      headers: { ...authHeader('buyer'), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(409);
  });

  it('creates an operation for an authenticated seller', async () => {
    vi.mocked(getOne)
      .mockResolvedValueOnce({ role: 'seller', phone: '11999999999' })
      .mockResolvedValueOnce({ id: 'op-1', status: 'pending', ...validBody });

    const res = await request('/', {
      method: 'POST',
      headers: { ...authHeader('seller'), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('op-1');
  });

  it('rejects an invalid amount below the minimum', async () => {
    const res = await request('/', {
      method: 'POST',
      headers: { ...authHeader('seller'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, amount: 10 }),
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /:id/confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for a non-existent operation', async () => {
    vi.mocked(getOne).mockResolvedValueOnce(null);

    const res = await request('/op-404/confirm', {
      method: 'POST',
      headers: { ...authHeader('buyer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: '11111111-1111-1111-1111-111111111111' }),
    });

    expect(res.status).toBe(404);
  });

  it('rejects confirming an operation that is not pending', async () => {
    vi.mocked(getOne).mockResolvedValueOnce({ id: 'op-1', status: 'confirmed' });

    const res = await request('/op-1/confirm', {
      method: 'POST',
      headers: { ...authHeader('buyer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: '11111111-1111-1111-1111-111111111111' }),
    });

    expect(res.status).toBe(409);
  });

  it('atomically confirms a pending operation and creates the transaction record', async () => {
    const buyerId = '11111111-1111-1111-1111-111111111111';

    vi.mocked(getOne)
      .mockResolvedValueOnce({
        id: 'op-1',
        status: 'pending',
        seller_id: 'seller-1',
        amount: 10000,
      })
      .mockResolvedValueOnce({ email: 'seller@example.com', phone: '11999999999' })
      .mockResolvedValueOnce({ name: 'Comprador Corp' });

    const updatedOperation = {
      id: 'op-1',
      status: 'confirmed',
      buyer_id: buyerId,
      total_price: 500,
      commission_amount: 25,
    };

    vi.mocked(transaction).mockImplementationOnce(async (callback: any) => {
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [updatedOperation] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      return callback(client);
    });

    const res = await request('/op-1/confirm', {
      method: 'POST',
      headers: { ...authHeader('buyer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
