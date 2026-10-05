'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Auth context — tracks whether the current browser session has a valid
 * admin cookie. The cookie itself is httpOnly so JavaScript can't read
 * it; we instead poll /api/auth/me to check status.
 *
 * Login/logout call the corresponding endpoints. The cookie is set/cleared
 * server-side, so a successful login automatically updates `authed`.
 */

interface AuthContextValue {
  authed: boolean;
  loading: boolean;
  login: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setAuthed(Boolean(data.authed));
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (pin: string) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error ?? 'Login failed' };
        }
        setAuthed(true);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthed(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ authed, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
