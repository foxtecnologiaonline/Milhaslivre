'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import type { AdminProduct, Seller } from '../../lib/types';

export default function AdminPanelPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return <p className="muted">Carregando...</p>;

  if (!user || user.role !== 'admin') {
    return (
      <p className="muted">
        <Link href="/login">Entre</Link> com uma conta de administrador para acessar o painel.
      </p>
    );
  }

  return (
    <div className="stack">
      <h1>Painel administrativo</h1>
      {error && <p className="error">{error}</p>}

      <h2>Aprovação de vendedores</h2>
      <PendingSellers token={accessToken} onError={setError} />

      <h2>Moderação de catálogo</h2>
      <CatalogModeration token={accessToken} onError={setError} />
    </div>
  );
}

function PendingSellers({
  token,
  onError,
}: {
  token: string | null;
  onError: (message: string | null) => void;
}) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Seller[]>('/sellers?status=pending', { token });
      setSellers(result);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao carregar vendedores');
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="muted">Carregando...</p>;
  if (sellers.length === 0) return <p className="muted">Nenhum vendedor aguardando aprovação.</p>;

  return (
    <div className="stack">
      {sellers.map((seller) => (
        <SellerRow key={seller.id} seller={seller} token={token} onError={onError} onDone={load} />
      ))}
    </div>
  );
}

function SellerRow({
  seller,
  token,
  onError,
  onDone,
}: {
  seller: Seller;
  token: string | null;
  onError: (message: string | null) => void;
  onDone: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function decide(status: 'approved' | 'rejected') {
    setSubmitting(true);
    onError(null);
    try {
      await apiFetch(`/sellers/${seller.id}/status`, {
        method: 'PATCH',
        token,
        body: status === 'rejected' ? { status, reason } : { status },
      });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao decidir sobre o vendedor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card stack">
      <div className="row">
        <strong>{seller.companyName}</strong>
        <span className="badge pending">Pendente</span>
      </div>
      <p className="muted">Documento: {seller.document}</p>
      {!rejecting ? (
        <div className="row" style={{ gap: 12, justifyContent: 'flex-start' }}>
          <button className="btn" disabled={submitting} onClick={() => decide('approved')}>
            Aprovar
          </button>
          <button className="btn danger" disabled={submitting} onClick={() => setRejecting(true)}>
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor={`reason-${seller.id}`}>Motivo da rejeição</label>
            <input
              id={`reason-${seller.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-start' }}>
            <button
              className="btn danger"
              disabled={submitting || !reason.trim()}
              onClick={() => decide('rejected')}
            >
              {submitting ? 'Enviando...' : 'Confirmar rejeição'}
            </button>
            <button className="btn secondary" disabled={submitting} onClick={() => setRejecting(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogModeration({
  token,
  onError,
}: {
  token: string | null;
  onError: (message: string | null) => void;
}) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<AdminProduct[]>('/products/admin/all', { token });
      setProducts(result);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleBlocked(product: AdminProduct) {
    setUpdating(product.id);
    onError(null);
    try {
      await apiFetch(`/products/${product.id}/moderation`, {
        method: 'PATCH',
        token,
        body: { isBlocked: !product.isBlocked },
      });
      await load();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao moderar produto');
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (products.length === 0) return <p className="muted">Nenhum produto cadastrado ainda.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td>{product.title}</td>
            <td>
              <span className={`badge ${product.isBlocked ? 'danger' : 'success'}`}>
                {product.isBlocked ? 'Bloqueado' : 'Visível'}
              </span>
            </td>
            <td>
              <button
                className={`btn ${product.isBlocked ? 'secondary' : 'danger'}`}
                disabled={updating === product.id}
                onClick={() => toggleBlocked(product)}
              >
                {updating === product.id ? 'Atualizando...' : product.isBlocked ? 'Desbloquear' : 'Bloquear'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
