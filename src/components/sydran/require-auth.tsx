'use client';

import { useEffect } from 'react';
import { useAuth } from './use-auth';
import { useRouter } from './router';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock } from 'lucide-react';

/**
 * Route guard — wraps protected views (delivery, mod, admin) and
 * redirects unauthenticated users to the login page.
 *
 * While the auth check is in flight, shows a loading skeleton so the
 * protected content never flashes on screen before the redirect.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, loading } = useAuth();
  const { navigate } = useRouter();

  // Navigate as a side-effect of detecting unauthenticated access.
  // We intentionally don't setState here — the redirect itself is the
  // action, and the next render (after navigate triggers a hashchange)
  // will unmount this component naturally.
  useEffect(() => {
    if (!loading && !authed) {
      navigate({ name: 'login' });
    }
  }, [authed, loading, navigate]);

  if (loading || !authed) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Checking access…' : 'Redirecting to sign in…'}
          </p>
          <Skeleton className="mt-4 h-32 w-full max-w-md" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
