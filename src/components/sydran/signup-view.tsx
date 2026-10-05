'use client';

import { useEffect, useState } from 'react';
import { useRouter } from './router';
import { useUserAuth } from './use-user-auth';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, CheckCircle2, AlertCircle, Copy, RefreshCw, Coins } from 'lucide-react';
import { formatPrice } from '@/lib/sydran';

/**
 * Sign-up page.
 *
 * Flow:
 *   1. User enters desired username + password + Minecraft IGN.
 *   2. Server generates a random verifyAmount (1000–9999 coins).
 *   3. The page shows the exact /pay command to run in-game.
 *   4. User runs it; the payment matcher detects the payment by IGN + amount.
 *   5. The page polls /api/user/verify-status every 3s — once verified,
 *      it auto-redirects to the login page.
 */
export function SignupView() {
  const { navigate } = useRouter();
  const { signup } = useUserAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [minecraftIgn, setMinecraftIgn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);
  const [verifyAmount, setVerifyAmount] = useState<number | null>(null);
  const [minecraftIgnDisplay, setMinecraftIgnDisplay] = useState<string>('');
  const [verified, setVerified] = useState(false);
  const [polling, setPolling] = useState(false);

  // Poll verify-status every 3s once the account is created.
  useEffect(() => {
    if (!createdUsername) return;
    setPolling(true);
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/user/verify-status?username=${encodeURIComponent(createdUsername)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.user?.verified) {
          setVerified(true);
          setPolling(false);
          toast({
            title: 'IGN verified!',
            description: 'Your Minecraft IGN is now confirmed. You can log in.',
          });
          setTimeout(() => navigate({ name: 'user-login' }), 2000);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [createdUsername, toast, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signup(username, password, minecraftIgn);
    setSubmitting(false);
    if (result.ok && result.verifyAmount != null) {
      setCreatedUsername(username.trim().toLowerCase());
      setVerifyAmount(result.verifyAmount);
      setMinecraftIgnDisplay(minecraftIgn.trim());
      toast({
        title: 'Account created',
        description: `Pay ${formatPrice(result.verifyAmount)} to doodly_yousuf in-game to verify your IGN.`,
      });
    } else {
      setError(result.error ?? 'Signup failed');
    }
  };

  const copyPayCommand = () => {
    if (verifyAmount == null) return;
    const cmd = `/pay doodly_yousuf ${verifyAmount}`;
    navigator.clipboard.writeText(cmd);
    toast({ title: 'Copied', description: cmd });
  };

  const simulateVerify = async () => {
    if (!createdUsername) return;
    try {
      const res = await fetch('/api/user/simulate-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: createdUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verify failed');
      setVerified(true);
      toast({
        title: 'Payment matched',
        description: `Verified ${data.matched.ign} paid ${formatPrice(data.matched.amount)} to ${data.matched.paidTo}.`,
      });
      setTimeout(() => navigate({ name: 'user-login' }), 1500);
    } catch (e) {
      toast({
        title: 'Verify failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </button>

      {!createdUsername ? (
        <div className="rounded-[3px] border-[1.5px] border-primary bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-wide text-xl font-extrabold leading-tight">Create account</h1>
              <p className="text-xs text-muted-foreground">Verify your Minecraft IGN to start ordering.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-semibold">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. sydran_fan"
                autoComplete="off"
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">3–20 chars, lowercase letters/numbers/underscore.</p>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">Min 6 characters.</p>
            </div>
            <div>
              <label htmlFor="ign" className="mb-1.5 block text-sm font-semibold">Minecraft IGN</label>
              <Input
                id="ign"
                value={minecraftIgn}
                onChange={(e) => setMinecraftIgn(e.target.value)}
                placeholder="e.g. Doodly_yousuf"
                autoComplete="off"
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">Your in-game username. Must match exactly.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-[3px] border-[1.5px] border-accent bg-accent/10 p-2.5 text-sm text-accent-deep">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="sydran-btn w-full">
              {submitting ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={() => navigate({ name: 'user-login' })}
              className="font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      ) : verified ? (
        <div className="rounded-[3px] border-[1.5px] border-emerald-500 bg-emerald-500/5 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h1 className="font-wide text-xl font-extrabold">IGN verified!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Redirecting to sign in…</p>
        </div>
      ) : (
        <div className="rounded-[3px] border-[1.5px] border-primary bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-wide text-xl font-extrabold leading-tight">Verify your IGN</h1>
              <p className="text-xs text-muted-foreground">Account created — one step left.</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            In-game as <strong className="text-foreground">{minecraftIgnDisplay}</strong>, send exactly:
          </p>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-[3px] border-[1.5px] border-primary bg-primary p-3 text-primary-foreground">
            <code className="font-mono text-sm">
              /pay doodly_yousuf {verifyAmount}
            </code>
            <button
              onClick={copyPayCommand}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[oklch(0.5_0.025_65)] px-2.5 py-1 text-xs hover:border-primary-foreground"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            The matcher checks that the sender IGN matches your account and the amount is exactly{' '}
            <strong className="text-foreground">{verifyAmount}</strong> coins. Once matched, your IGN is verified.
          </p>

          {polling && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Waiting for your payment…</span>
            </div>
          )}

          <button
            onClick={simulateVerify}
            className="sydran-btn sydran-btn-ghost mt-5 w-full text-sm"
          >
            Simulate payment match (demo only)
          </button>
        </div>
      )}
    </div>
  );
}
