'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { formatPriceCents } from '../../lib/format-price';
import type { CartItem, Order } from '../../lib/types';

export default function CartPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<CartItem[]>('/cart', { token: accessToken });
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar carrinho');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'buyer') {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  async function removeItem(id: string) {
    try {
      await apiFetch(`/cart/items/${id}`, { method: 'DELETE', token: accessToken });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover item');
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    try {
      const order = await apiFetch<Order>('/checkout', { method: 'POST', token: accessToken });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao finalizar compra');
    } finally {
      setCheckingOut(false);
    }
  }

  if (authLoading || loading) return <p className="muted">Carregando...</p>;

  if (!user || user.role !== 'buyer') {
    return (
      <p className="muted">
        <Link href="/login">Entre</Link> como comprador para ver seu carrinho.
      </p>
    );
  }

  const total = items.reduce((sum, item) => sum + item.offer.priceCents * item.quantity, 0);

  return (
    <div className="stack">
      <h1>Carrinho</h1>

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="muted">
          Seu carrinho está vazio. <Link href="/">Ver produtos</Link>.
        </p>
      ) : (
        <>
          <div className="stack">
            {items.map((item) => (
              <div key={item.id} className="card row">
                <div>
                  <div>Oferta {item.offer.condition === 'new' ? 'nova' : 'usada'}</div>
                  <div className="muted">
                    {item.quantity} × {formatPriceCents(item.offer.priceCents)}
                  </div>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <span className="price">{formatPriceCents(item.offer.priceCents * item.quantity)}</span>
                  <button className="btn danger" onClick={() => removeItem(item.id)}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="row card">
            <strong>Total</strong>
            <span className="price">{formatPriceCents(total)}</span>
          </div>

          <button className="btn" disabled={checkingOut} onClick={checkout}>
            {checkingOut ? 'Finalizando...' : 'Finalizar compra'}
          </button>
        </>
      )}
    </div>
  );
}
