'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { formatPriceCents } from '../../lib/format-price';
import type { Seller, SubOrder } from '../../lib/types';

const SUB_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const NEXT_STATUS: Record<string, 'shipped' | 'delivered' | undefined> = {
  paid: 'shipped',
  shipped: 'delivered',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  shipped: 'Marcar como enviado',
  delivered: 'Marcar como entregue',
};

export default function SellerPanelPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [seller, setSeller] = useState<Seller | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const loadSeller = useCallback(async () => {
    setError(null);
    try {
      const found = await apiFetch<Seller>('/sellers/me', { token: accessToken });
      setSeller(found);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSeller(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil de seller');
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'seller') return;
    loadSeller();
  }, [authLoading, user, loadSeller]);

  if (authLoading || (user?.role === 'seller' && seller === undefined)) {
    return <p className="muted">Carregando...</p>;
  }

  if (!user || user.role !== 'seller') {
    return (
      <p className="muted">
        <Link href="/login">Entre</Link> com uma conta de vendedor para acessar o painel.
      </p>
    );
  }

  if (!seller) {
    return (
      <div className="stack">
        <h1>Painel do vendedor</h1>
        <OnboardForm onDone={loadSeller} />
      </div>
    );
  }

  if (seller.status === 'pending') {
    return (
      <div className="stack">
        <h1>Painel do vendedor</h1>
        <p className="card">
          Cadastro de <strong>{seller.companyName}</strong> enviado. Aguardando aprovação do
          administrador.
        </p>
      </div>
    );
  }

  if (seller.status === 'rejected') {
    return (
      <div className="stack">
        <h1>Painel do vendedor</h1>
        <p className="card error">
          Cadastro de <strong>{seller.companyName}</strong> foi rejeitado
          {seller.rejectedReason ? `: ${seller.rejectedReason}` : '.'}
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Painel do vendedor</h1>
      <p className="muted">
        {seller.companyName} · <span className="badge success">Aprovado</span>
      </p>
      {error && <p className="error">{error}</p>}

      <h2>Cadastrar produto</h2>
      <ProductForm token={accessToken} onError={setError} />

      <h2>Meus pedidos</h2>
      <OrdersList sellerId={seller.id} token={accessToken} onError={setError} />
    </div>
  );
}

function OnboardForm({ onDone }: { onDone: () => void }) {
  const { accessToken } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [document, setDocument] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/sellers', {
        method: 'POST',
        token: accessToken,
        body: { companyName, document },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar vendedor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="muted">Complete o cadastro de vendedor para começar a anunciar produtos.</p>
      <div className="field">
        <label htmlFor="companyName">Nome da loja</label>
        <input
          id="companyName"
          required
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="document">CNPJ/CPF</label>
        <input
          id="document"
          required
          value={document}
          onChange={(event) => setDocument(event.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : 'Cadastrar'}
      </button>
    </form>
  );
}

function ProductForm({
  token,
  onError,
}: {
  token: string | null;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [slaDays, setSlaDays] = useState('3');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    onError(null);
    try {
      const priceCents = Math.round(Number(price.replace(',', '.')) * 100);
      const product = await apiFetch<{ id: string }>('/products', {
        method: 'POST',
        token,
        body: {
          title,
          description,
          ...(brand ? { brand } : {}),
        },
      });
      await apiFetch(`/products/${product.id}/offers`, {
        method: 'POST',
        token,
        body: {
          priceCents,
          stock: Number(stock),
          condition,
          slaDays: Number(slaDays),
        },
      });
      setSuccess(`Produto "${title}" cadastrado.`);
      setTitle('');
      setDescription('');
      setBrand('');
      setPrice('');
      setStock('');
      setSlaDays('3');
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao cadastrar produto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Título</label>
        <input id="title" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <textarea
          id="description"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="brand">Marca (opcional)</label>
        <input id="brand" value={brand} onChange={(event) => setBrand(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="price">Preço (R$)</label>
        <input
          id="price"
          required
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="stock">Estoque</label>
        <input
          id="stock"
          type="number"
          min={0}
          required
          value={stock}
          onChange={(event) => setStock(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="condition">Condição</label>
        <select
          id="condition"
          value={condition}
          onChange={(event) => setCondition(event.target.value as 'new' | 'used')}
        >
          <option value="new">Novo</option>
          <option value="used">Usado</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="slaDays">Prazo de envio (dias)</label>
        <input
          id="slaDays"
          type="number"
          min={1}
          required
          value={slaDays}
          onChange={(event) => setSlaDays(event.target.value)}
        />
      </div>
      {success && <p className="muted">{success}</p>}
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Cadastrando...' : 'Cadastrar produto'}
      </button>
    </form>
  );
}

function OrdersList({
  sellerId,
  token,
  onError,
}: {
  sellerId: string;
  token: string | null;
  onError: (message: string | null) => void;
}) {
  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<SubOrder[]>(`/sellers/${sellerId}/orders`, { token });
      setSubOrders(result);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [sellerId, token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(subOrder: SubOrder) {
    const next = NEXT_STATUS[subOrder.status];
    if (!next) return;
    setUpdating(subOrder.id);
    onError(null);
    try {
      await apiFetch(`/suborders/${subOrder.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: next },
      });
      await load();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao atualizar status');
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="muted">Carregando pedidos...</p>;
  if (subOrders.length === 0) return <p className="muted">Nenhum pedido ainda.</p>;

  return (
    <div className="stack">
      {subOrders.map((subOrder) => {
        const next = NEXT_STATUS[subOrder.status];
        return (
          <div key={subOrder.id} className="card stack">
            <div className="row">
              <span className="muted">Pedido {subOrder.orderId.slice(0, 8)}</span>
              <span className="badge">{SUB_ORDER_STATUS_LABEL[subOrder.status] ?? subOrder.status}</span>
            </div>
            <table>
              <tbody>
                {subOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.qty}×</td>
                    <td>{formatPriceCents(item.unitPriceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <strong>Subtotal</strong>
              <strong>{formatPriceCents(subOrder.subtotalCents + subOrder.shippingCents)}</strong>
            </div>
            {next && (
              <button
                className="btn secondary"
                disabled={updating === subOrder.id}
                onClick={() => advance(subOrder)}
                style={{ maxWidth: 220 }}
              >
                {updating === subOrder.id ? 'Atualizando...' : NEXT_STATUS_LABEL[next]}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
