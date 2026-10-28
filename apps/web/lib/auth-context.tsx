'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from './api-client';
import type { AuthResult, User } from './types';

const STORAGE_KEY = 'marketplace.auth';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: 'buyer' | 'seller';
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function writeStoredAuth(auth: StoredAuth | null) {
  try {
    if (auth) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — session just won't persist.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setUser(stored.user);
      setAccessToken(stored.accessToken);
    }
    setLoading(false);
  }, []);

  function applyAuthResult(result: AuthResult) {
    setUser(result.user);
    setAccessToken(result.accessToken);
    writeStoredAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }

  async function login(email: string, password: string) {
    const result = await apiFetch<AuthResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    applyAuthResult(result);
  }

  async function register(input: {
    email: string;
    password: string;
    name: string;
    role: 'buyer' | 'seller';
  }) {
    const result = await apiFetch<AuthResult>('/auth/register', {
      method: 'POST',
      body: input,
    });
    applyAuthResult(result);
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    writeStoredAuth(null);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
