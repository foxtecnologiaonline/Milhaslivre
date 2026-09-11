'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/api-client';
import type { Product } from '../lib/types';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load('');
  }, []);

  async function load(q: string) {
    setLoading(true);
    setError(null);
    try {
      const path = q ? `/products?query=${encodeURIComponent(q)}` : '/products';
      const results = await apiFetch<Product[]>(path);
      setProducts(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar produtos');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    load(query);
  }

  return (
    <div className="stack">
      <h1>Encontre o que precisa</h1>

      <form onSubmit={handleSubmit} className="row" style={{ maxWidth: 480 }}>
        <input
          type="search"
          placeholder="Buscar produtos..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6 }}
        />
        <button className="btn" type="submit">
          Buscar
        </button>
      </form>

      {loading && <p className="muted">Carregando...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && products.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}

      <div className="grid">
        {products.map((product) => (
          <Link key={product.id} href={`/products/${product.id}`} className="card">
            <h3>{product.title}</h3>
            <p className="muted">{product.brand ?? 'Sem marca'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
