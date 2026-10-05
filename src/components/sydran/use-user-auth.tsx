'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * User (customer) auth context.
 * Distinct from staff auth (use-auth.tsx) — customers verify their
 * Minecraft IGN by paying a small amount to doodly_yousuf.
 */

interface UserSession {
  id: string;
  username: string;
  minecraftIgn: string;
  balance: number;
}

interface UserAuthContextValue {
  user: UserSession | null;
  loading: boolean;
  teamOnline: boolean;
  signup: (username: string, password: string, minecraftIgn: string) => Promise<{ ok: boolean; verifyAmount?: number; error?: string }>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean; verifyAmount?: number; teamOffline?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const UserAuthContext = createContext<UserAuthContextValue | null>(null);

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [teamOnline, setTeamOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me');
      const data = await res.json();
      setUser(data.user ?? null);
      setTeamOnline(data.teamOnline ?? false);
    } catch {
      setUser(null);
      setTeamOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 30s for teamOnline status — so the login button knows
    // whether to enable itself or show "Team Sydran is offline".
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const signup = useCallback(
    async (username: string, password: string, minecraftIgn: string) => {
      try {
        const res = await fetch('/api/user/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, minecraftIgn }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error ?? 'Signup failed' };
        return { ok: true, verifyAmount: data.user.verifyAmount };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
      }
    },
    []
  );

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data.error ?? 'Login failed',
          needsVerification: data.needsVerification,
          verifyAmount: data.verifyAmount,
          teamOffline: data.teamOffline,
        };
      }
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/user/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <UserAuthContext.Provider value={{ user, loading, teamOnline, signup, login, logout, refresh }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error('useUserAuth must be used inside <UserAuthProvider>');
  return ctx;
}
