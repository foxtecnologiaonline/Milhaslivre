'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

export function NavHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          Marketplace
        </Link>
        <nav className="site-nav">
          <Link href="/">Início</Link>
          {user?.role === 'buyer' && <Link href="/cart">Carrinho</Link>}
          {user?.role === 'seller' && <Link href="/seller">Painel do seller</Link>}
          {user?.role === 'admin' && <Link href="/admin">Painel admin</Link>}
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <>
              <Link href="/login">Entrar</Link>
              <Link href="/register">Cadastrar</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
