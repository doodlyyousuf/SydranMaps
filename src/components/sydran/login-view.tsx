'use client';

import { useEffect, useState } from 'react';
import { useRouter } from './router';
import { useAuth } from './use-auth';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

/**
 * Login page — PIN-based staff sign-in.
 *
 * Customers don't need to sign in (they browse + place orders as guests).
 * Only delivery members, admins, and the Fabric mod upload flow require
 * authentication. The PIN is set via the ADMIN_PIN env var on the server.
 */
export function LoginView() {
  const { navigate } = useRouter();
  const { authed, loading, login } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authed, bounce to the admin panel.
  useEffect(() => {
    if (!loading && authed) {
      navigate({ name: 'admin' });
    }
  }, [authed, loading, navigate]);

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
      toast({
        title: 'Signed in',
        description: 'Admin and delivery tools are now available.',
      });
      navigate({ name: 'admin' });
    } else {
      setError(result.error ?? 'Login failed');
      setPin('');
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </button>

      <div className="rounded-[3px] border-[1.5px] border-primary bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-wide text-xl font-extrabold leading-tight">
              Staff sign in
            </h1>
            <p className="text-xs text-muted-foreground">
              Delivery members, admins, and the Fabric mod upload tool.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="mb-1.5 block text-sm font-semibold">
              Admin PIN
            </label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="font-mono tracking-[0.4em]"
              autoFocus
              disabled={submitting}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Set in the server <code className="sydran-code">ADMIN_PIN</code> env var.
              Sessions last 12 hours.
            </p>
          </div>

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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>
            Customers don't need to sign in — only staff does. Browse the
            gallery and check out as a guest.
          </span>
        </div>
      </div>
    </div>
  );
}
