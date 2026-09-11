'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { formatPriceCents } from '../../../lib/format-price';
import type { ProductWithOffers, Review } from '../../../lib/types';

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const { user, accessToken } = useAuth();
  const [product, setProduct] = useState<ProductWithOffers | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingOfferId, setAddingOfferId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [productResult, reviewsResult] = await Promise.all([
          apiFetch<ProductWithOffers>(`/products/${params.id}`),
          apiFetch<Review[]>(`/products/${params.id}/reviews`),
        ]);
        if (!cancelled) {
          setProduct(productResult);
          setReviews(reviewsResult);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar produto');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function addToCart(offerId: string) {
    setMessage(null);
    setAddingOfferId(offerId);
    try {
      await apiFetch('/cart/items', {
        method: 'POST',
        token: accessToken,
        body: { offerId, quantity: 1 },
      });
      setMessage('Adicionado ao carrinho.');
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(`Não foi possível adicionar: ${err.message}`);
      } else {
        setMessage('Não foi possível adicionar ao carrinho.');
      }
    } finally {
      setAddingOfferId(null);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!product) return <p className="muted">Produto não encontrado.</p>;

  return (
    <div className="stack">
      <div>
        <h1>{product.title}</h1>
        <p className="muted">{product.brand ?? 'Sem marca'}</p>
        <p>{product.description}</p>
      </div>

      <section>
        <h2>Ofertas</h2>
        {product.offers.length === 0 && <p className="muted">Nenhuma oferta disponível ainda.</p>}
        <div className="stack">
          {product.offers.map((offer) => (
            <div key={offer.id} className="card row">
              <div>
                <div className="price">{formatPriceCents(offer.priceCents)}</div>
                <div className="muted">
                  {offer.condition === 'new' ? 'Novo' : 'Usado'} · {offer.stock} em estoque · entrega em{' '}
                  {offer.slaDays} dias
                </div>
              </div>
              {user?.role === 'buyer' ? (
                <button
                  className="btn"
                  disabled={addingOfferId === offer.id || offer.stock === 0}
                  onClick={() => addToCart(offer.id)}
                >
                  {addingOfferId === offer.id ? 'Adicionando...' : 'Adicionar ao carrinho'}
                </button>
              ) : (
                <span className="muted">Entre como comprador para comprar</span>
              )}
            </div>
          ))}
        </div>
        {message && <p className="muted">{message}</p>}
      </section>

      <section>
        <h2>Avaliações</h2>
        {reviews.length === 0 && <p className="muted">Ainda sem avaliações.</p>}
        <div className="stack">
          {reviews.map((review) => (
            <div key={review.id} className="card">
              <div className="price">{'★'.repeat(review.rating)}</div>
              {review.comment && <p>{review.comment}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
