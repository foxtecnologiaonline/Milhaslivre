import { writable } from 'svelte/store';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'seller' | 'buyer' | 'admin';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,

    login: async (email: string, password: string) => {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          throw new Error('Login failed');
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);

        update((s) => ({
          ...s,
          user: data.user,
          token: data.token,
          isLoading: false,
        }));

        return data;
      } catch (err) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: (err as Error).message,
        }));
        throw err;
      }
    },

    register: async (data: Record<string, string>) => {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          throw new Error('Registration failed');
        }

        const result = await res.json();
        localStorage.setItem('token', result.token);

        update((s) => ({
          ...s,
          user: result.user,
          token: result.token,
          isLoading: false,
        }));

        return result;
      } catch (err) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: (err as Error).message,
        }));
        throw err;
      }
    },

    logout: () => {
      localStorage.removeItem('token');
      set(initialState);
    },
  };
}

export const authStore = createAuthStore();
