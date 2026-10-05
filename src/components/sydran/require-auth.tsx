'use client';

import { useState } from 'react';
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
 * The prompt has NO visible branding that hints admin tools exist —
 * a casual visitor who stumbles onto #/admin sees a minimal "Access
 * restricted" prompt asking for a PIN. Only people who already know
 * the URL and the PIN get in.
 *
 * Once authed, the protected children render and a discreet sign-out
 * button appears at the bottom-right of the screen.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, loading, login, logout } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } else {
      setError(result.error ?? 'Access denied');
      setPin('');
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
            disabled={submitting}
            aria-label="Access PIN"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-[3px] border-[1.5px] border-accent bg-accent/10 p-2.5 text-sm text-accent-deep">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || pin.length < 4}
            className="sydran-btn w-full"
          >
            {submitting ? 'Checking…' : 'Continue'}
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
