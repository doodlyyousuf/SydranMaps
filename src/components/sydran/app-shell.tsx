'use client';

import { useEffect } from 'react';
import { useRouter, routeToHash } from './router';
import { useCart } from './use-cart';
import { AuthProvider, useAuth } from './use-auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { ShoppingCart, LogIn, LogOut } from 'lucide-react';

const PUBLIC_NAV = [{ name: 'gallery' as const, label: 'Gallery' }];
const PROTECTED_NAV = [
  { name: 'delivery' as const, label: 'Delivery' },
  { name: 'mod' as const, label: 'Mod Panel' },
  { name: 'admin' as const, label: 'Admin' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  const { count, hydrated } = useCart();
  const { authed, loading, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('sydran-welcomed')) {
      sessionStorage.setItem('sydran-welcomed', '1');
      setTimeout(() => {
        toast({
          title: 'Welcome to Sydran Maps',
          description:
            'Browse the catalog, click cards to select, then check out. The maps are delivered to your Minecraft base.',
        });
      }, 400);
    }
  }, [toast]);

  const handleLogout = async () => {
    await logout();
    toast({ title: 'Signed out' });
    navigate({ name: 'gallery' });
  };

  return (
    <div className="sydran-app-shell">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-4 px-[clamp(16px,5vw,64px)] py-3.5"
        style={{
          background: 'oklch(0.935 0.03 85 / 0.6)',
          backdropFilter: 'blur(12px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        }}
      >
        <a
          href={routeToHash({ name: 'gallery' })}
          className="font-wide text-lg font-extrabold tracking-tight no-underline"
        >
          sydran<span className="text-accent">.</span>maps
        </a>

        <nav className="hidden items-center gap-[clamp(14px,3vw,32px)] text-sm md:flex">
          {PUBLIC_NAV.map((item) => {
            const active = route.name === item.name;
            return (
              <button
                key={item.name}
                onClick={() => navigate({ name: item.name })}
                className={cn(
                  'no-underline transition-colors',
                  active
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            );
          })}
          {/* Protected nav — only visible when authenticated */}
          {authed &&
            PROTECTED_NAV.map((item) => {
              const active = route.name === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate({ name: item.name })}
                  className={cn(
                    'no-underline transition-colors',
                    active
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Login / Logout button */}
          {loading ? (
            <span className="text-sm text-muted-foreground">…</span>
          ) : authed ? (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <button
              onClick={() => navigate({ name: 'login' })}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
              aria-label="Admin sign in"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Staff sign in</span>
            </button>
          )}

          <button
            onClick={() => navigate({ name: 'cart' })}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            {hydrated && count > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile nav strip — only public links + protected when authed */}
      <nav
        className="flex items-center gap-1 overflow-x-auto px-4 py-2 md:hidden sydran-scroll"
        style={{ background: 'oklch(0.895 0.042 82 / 0.6)', backdropFilter: 'blur(8px)' }}
      >
        {[...PUBLIC_NAV, ...(authed ? PROTECTED_NAV : [])].map((item) => {
          const active = route.name === item.name;
          return (
            <button
              key={item.name}
              onClick={() => navigate({ name: item.name })}
              className={cn(
                'inline-flex shrink-0 items-center px-3 py-1.5 text-sm font-medium no-underline transition-colors',
                active
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main>{children}</main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border px-[clamp(16px,5vw,64px)] py-7 text-sm text-muted-foreground">
        <span>sydran.maps · Map-art marketplace</span>
        <span>Manual delivery only — no automated bots</span>
      </footer>

      <SonnerToaster richColors position="top-right" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
