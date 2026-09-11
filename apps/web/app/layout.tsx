import type { ReactNode } from 'react';
import { NavHeader } from '../components/nav-header';
import { AuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata = {
  title: 'Marketplace',
  description: 'Marketplace multi-vendedor',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <NavHeader />
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
