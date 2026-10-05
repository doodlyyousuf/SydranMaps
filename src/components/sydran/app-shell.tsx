'use client';

import { useEffect, useRef } from 'react';
import { useRouter, routeToHash } from './router';
import { useCart } from './use-cart';
import { AuthProvider, useAuth } from './use-auth';
import { useUserAuth } from './use-user-auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { ShoppingCart, User, LogOut } from 'lucide-react';

// Only the gallery nav link is visible publicly. Admin / Mod Panel /
// Delivery are accessible by typing the URL directly (#/admin, #/mod,
// #/delivery) — they render an inline PIN prompt when unauthenticated.
const PUBLIC_NAV = [{ name: 'gallery' as const, label: 'Gallery' }];

function Shell({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  const { count, hydrated } = useCart();
  const { authed } = useAuth();
  const { user, teamOnline, logout: userLogout } = useUserAuth();
  const { toast } = useToast();

  // Pointer-following glow that lights up the background grid near the
  // cursor. Uses CSS custom properties updated via rAF for smoothness.
  // The glow is intentionally very faint (0.12 alpha accent color) so
  // the background stays subtle — visible only as a soft halo.
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = glowRef.current;
        if (!el) return;
        el.style.setProperty('--gx', `${lastX}px`);
        el.style.setProperty('--gy', `${lastY}px`);
        el.style.opacity = '1';
        // Fade out after 2.5s of no movement.
        clearTimeout((el as HTMLDivElement & { _t?: number })._t);
        (el as HTMLDivElement & { _t?: number })._t = window.setTimeout(() => {
          el.style.opacity = '0';
        }, 2500);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  return (
    <div className="sydran-app-shell">
      {/* ── Pointer-following grid glow ───────────────────────────────
          A fixed full-viewport div whose radial-gradient mask follows
          the cursor (--gx, --gy are set by the pointermove effect above).
          Sits at z-index 0 so every other element (header, cards, etc.)
          naturally renders above it. */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-[1500ms]"
        style={{
          opacity: 0,
          background:
            'radial-gradient(circle 260px at var(--gx, -100px) var(--gy, -100px), oklch(0.53 0.17 36 / 0.18), transparent 70%)',
        }}
      />

      {/* ── Header — public-facing only. No auth UI visible. ───────── */}
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
        </nav>

        <div className="flex items-center gap-2">
          {/* Account button — shows IGN + balance when logged in,
              "Sign in" when not. Discreet but visible so customers
              can find the login page. */}
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => userLogout().then(() => toast({ title: 'Signed out' }))}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user.minecraftIgn}</span>
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">
                  {(user.balance / 1_000_000).toFixed(1)}M
                </span>
                <LogOut className="ml-1 h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate({ name: 'user-login' })}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Sign in"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
              {/* Small online/offline dot indicator */}
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${teamOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                title={teamOnline ? 'Team Sydran online' : 'Team Sydran offline'}
              />
            </button>
          )}

          {/* Cart button */}
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

      {/* Mobile nav strip — public links only */}
      <nav
        className="flex items-center gap-1 overflow-x-auto px-4 py-2 md:hidden sydran-scroll"
        style={{ background: 'oklch(0.895 0.042 82 / 0.6)', backdropFilter: 'blur(8px)' }}
      >
        {PUBLIC_NAV.map((item) => {
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

      {/* ── Main content — rendered above the grid glow (z-index auto) */}
      <main className="relative z-10">{children}</main>

      {/* ── Footer — minimal, no admin hints ─────────────────────── */}
      <footer className="relative z-10 flex flex-wrap justify-between gap-3 border-t border-border px-[clamp(16px,5vw,64px)] py-7 text-sm text-muted-foreground">
        <span>sydran.maps · Map-art marketplace</span>
        <span>Manual delivery only — no automated bots</span>
      </footer>

      {/* Toasts — shown when auth state changes (login success, wrong PIN) */}
      <SonnerToaster richColors position="top-right" />
      {/* Marker — authed state is read by RequireAuth to decide whether
          to render the PIN prompt or the protected content. */}
      <span className="sr-only" aria-hidden>
        {authed ? 'authed' : 'guest'}
      </span>
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
