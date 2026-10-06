'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useRouter } from './router';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Lock, AlertCircle, LogOut } from 'lucide-react';

/**
 * Inline route guard — wraps protected views (delivery, mod, admin) and
 * renders a PIN prompt directly when unauthenticated, instead of
 * redirecting to a public login page.
 *
 * Once authed, pings the staff heartbeat every 2 minutes so the
 * "Team Sydran online" check stays true while staff is active.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, loading, login, logout } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>(undefined);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [submitDisabled, setSubmitDisabled] = useState(false);

  // Ping staff heartbeat when authed — keeps "Team Sydran online" true.
  // Re-pings every 2 minutes while a protected page is open.
  useEffect(() => {
    if (!authed) return;
    const ping = () => fetch('/api/staff/heartbeat', { method: 'POST' }).catch(() => {});
    ping();
    const interval = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError('PIN must be at least 4 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(pin);
    setSubmitting(false);
    if (result.ok) {
      toast({ title: 'Access granted' });
      setPin('');
      setAttemptsLeft(undefined);
      setLockedUntil(0);
    } else {
      setError(result.error ?? 'Access denied');
      setPin('');
      if (result.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
      if (result.lockedMs && result.lockedMs > 0) {
        setLockedUntil(Date.now() + result.lockedMs);
        setSubmitDisabled(true);
        // Re-enable after lockout expires
        setTimeout(() => setSubmitDisabled(false), result.lockedMs);
      }
    }
  };

  // Loading state — skeleton so nothing flashes.
  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-10 w-10 animate-pulse place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  // Authenticated — render the protected content + discreet sign-out.
  if (authed) {
    return (
      <>
        {children}
        {/* Discreet sign-out button — bottom-right, no prominent label.
            Visible only when authed so guests never see it. */}
        <button
          onClick={async () => {
            await logout();
            toast({ title: 'Signed out' });
            navigate({ name: 'gallery' });
          }}
          className="fixed bottom-4 right-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-border bg-background/80 text-muted-foreground opacity-50 backdrop-blur transition-opacity hover:opacity-100 hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </>
    );
  }

  // Unauthenticated — inline PIN prompt. No branding hints.
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-[3px] border-[1.5px] border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-wide text-lg font-extrabold leading-tight">
              Access restricted
            </h1>
            <p className="text-xs text-muted-foreground">
              This area is private.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="font-mono tracking-[0.4em]"
            autoFocus
            disabled={submitting || submitDisabled}
            aria-label="Access PIN"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-[3px] border-[1.5px] border-accent bg-accent/10 p-2.5 text-sm text-accent-deep">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span>{error}</span>
                {attemptsLeft !== undefined && attemptsLeft > 0 && !submitDisabled && (
                  <p className="mt-0.5 text-xs opacity-80">
                    {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining before lockout.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Lockout countdown */}
          {submitDisabled && lockedUntil > Date.now() && (
            <div className="rounded-[3px] border-[1.5px] border-rose-500 bg-rose-500/10 p-2.5 text-center text-sm text-rose-600">
              <Lock className="mr-1.5 inline h-3.5 w-3.5" />
              Locked. Try again in{' '}
              <LockoutCountdown lockedUntil={lockedUntil} onExpire={() => setSubmitDisabled(false)} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || pin.length < 4 || submitDisabled}
            className="sydran-btn w-full"
          >
            {submitting ? 'Checking…' : submitDisabled ? 'Locked' : 'Continue'}
          </button>
        </form>
      </div>

      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mx-auto mt-6 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Back to gallery
      </button>
    </div>
  );
}

/** Live countdown component — shows mm:ss until the lockout expires. */
function LockoutCountdown({ lockedUntil, onExpire }: { lockedUntil: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, lockedUntil - Date.now()));

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, lockedUntil - Date.now());
      setRemaining(left);
      if (left <= 0) {
        onExpire();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil, onExpire]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return (
    <span className="font-mono font-bold">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}
