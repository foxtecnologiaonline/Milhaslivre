import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '../api-client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on the happy path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '1', title: 'Produto' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: string; title: string }>('/products/1');

    expect(result).toEqual({ id: '1', title: 'Produto' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/products/1'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws an ApiError with the server message when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'not found' }), { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/products/missing')).rejects.toMatchObject(
      new ApiError(404, 'not found'),
    );
  });

  it('sends the Idempotency-Key header when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/payments/charge', {
      method: 'POST',
      body: { orderId: '1', method: 'pix' },
      idempotencyKey: 'key-123',
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Idempotency-Key']).toBe('key-123');
  });
});
