'use client';

import { useEffect, useState } from 'react';
import { useRouter } from './router';
import { useUserAuth } from './use-user-auth';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogIn, AlertCircle, Wifi, WifiOff } from 'lucide-react';

/**
 * User (customer) login page.
 *
 * Checks credentials + that the user is verified + that Team Sydran
 * is online. If Team Sydran is offline, the login button is disabled
 * with an explanatory message.
 */
export function UserLoginView() {
  const { navigate } = useRouter();
  const { login, teamOnline, user } = useUserAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, bounce to gallery.
  useEffect(() => {
    if (user) navigate({ name: 'gallery' });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(username, password);
    setSubmitting(false);
    if (result.ok) {
      toast({ title: 'Signed in', description: `Welcome back, ${username}!` });
      navigate({ name: 'gallery' });
    } else {
      setError(result.error ?? 'Login failed');
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

      <div className="rounded-[3px] border-[1.5px] border-primary bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <LogIn className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-wide text-xl font-extrabold leading-tight">Sign in</h1>
            <p className="text-xs text-muted-foreground">Access your orders and balance.</p>
          </div>
        </div>

        {/* Team Sydran online status banner */}
        <div
          className={`mb-4 flex items-center gap-2 rounded-[3px] border-[1.5px] p-2.5 text-sm ${
            teamOnline
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
              : 'border-accent/40 bg-accent/10 text-accent-deep'
          }`}
        >
          {teamOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span>
            {teamOnline
              ? 'Team Sydran is online — login available.'
              : 'Team Sydran is offline — login disabled until a staff member is online.'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-semibold">Username</label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={submitting || !teamOnline}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Password</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting || !teamOnline}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-[3px] border-[1.5px] border-accent bg-accent/10 p-2.5 text-sm text-accent-deep">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !teamOnline}
            className="sydran-btn w-full"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <button
            onClick={() => navigate({ name: 'signup' })}
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
