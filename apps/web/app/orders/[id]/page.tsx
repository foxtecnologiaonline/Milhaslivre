'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { formatPriceCents } from '../../../lib/format-price';
import type { Order } from '../../../lib/types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const { accessToken, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<Order>(`/orders/${params.id}`, { token: accessToken });
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  }, [params.id, accessToken]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  async function pay() {
    if (!order) return;
    setPaying(true);
    setError(null);
    try {
      await apiFetch('/payments/charge', {
        method: 'POST',
        token: accessToken,
        idempotencyKey,
        body: { orderId: order.id, method: 'pix' },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao processar pagamento');
    } finally {
      setPaying(false);
    }
  }

  if (authLoading || loading) return <p className="muted">Carregando...</p>;
  if (error && !order) return <p className="error">{error}</p>;
  if (!order) return <p className="muted">Pedido não encontrado.</p>;

  return (
    <div className="stack">
      <h1>Pedido</h1>
      <p className="muted">
        {order.id} · <span className="badge">{STATUS_LABEL[order.status] ?? order.status}</span>
      </p>

      {order.status === 'pending' && (
        <div className="card stack">
          <p>Pagamento pendente.</p>
          <button className="btn" disabled={paying} onClick={pay} style={{ maxWidth: 200 }}>
            {paying ? 'Processando...' : 'Pagar com Pix'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="stack">
        {order.subOrders.map((subOrder) => (
          <div key={subOrder.id} className="card stack">
            <div className="row">
              <strong>Vendedor {subOrder.sellerId.slice(0, 8)}</strong>
              <span className="badge">{STATUS_LABEL[subOrder.status] ?? subOrder.status}</span>
            </div>
            <table>
              <tbody>
                {subOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.qty}×</td>
                    <td>{formatPriceCents(item.unitPriceCents)}</td>
                    <td>{formatPriceCents(item.unitPriceCents * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row muted">
              <span>Frete</span>
              <span>{formatPriceCents(subOrder.shippingCents)}</span>
            </div>
            <div className="row">
              <strong>Subtotal</strong>
              <strong>{formatPriceCents(subOrder.subtotalCents + subOrder.shippingCents)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="row card">
        <strong>Total do pedido</strong>
        <span className="price">{formatPriceCents(order.totalCents)}</span>
      </div>
    </div>
  );
}
