'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, routeToHash } from './router';
import { useCart } from './use-cart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Map,
  ShoppingCart,
  Package,
  Truck,
  Settings2,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';

const NAV = [
  { name: 'gallery' as const, label: 'Gallery', icon: LayoutGrid },
  { name: 'delivery' as const, label: 'Delivery', icon: Truck },
  { name: 'mod' as const, label: 'Mod Panel', icon: Settings2 },
  { name: 'admin' as const, label: 'Admin', icon: Package },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useRouter();
  const { count, hydrated } = useCart();
  const { toast } = useToast();

  // Welcome toast on first visit so users know what they're looking at.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('sydran-welcomed')) {
      sessionStorage.setItem('sydran-welcomed', '1');
      // Small delay so the toast appears after initial paint.
      setTimeout(() => {
        toast({
          title: 'Welcome to Sydran Maps',
          description:
            'Browse the gallery, place an order, then open the Mod Panel to see the live Fabric mod status.',
        });
      }, 400);
    }
  }, [toast]);

  return (
    <div className="sydran-app-shell">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link
            href={routeToHash({ name: 'gallery' })}
            className="group flex items-center gap-2.5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-inner">
              <Map className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="font-pixel text-base font-bold tracking-tight">
                Sydran Maps
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Map-Art Store
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = route.name === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate({ name: item.name })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative gap-1.5"
              onClick={() => navigate({ name: 'cart' })}
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {hydrated && count > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 h-5 min-w-5 justify-center px-1.5 text-xs"
                >
                  {count}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden sydran-scroll">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route.name === item.name;
            return (
              <button
                key={item.name}
                onClick={() => navigate({ name: item.name })}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main>{children}</main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="mt-12 border-t border-border bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Map className="h-4 w-4" />
            <span>Sydran Maps · Map-art marketplace</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Phases 1–9 redesign</span>
            <span className="opacity-50">·</span>
            <span>Manual delivery only — no automated bots</span>
            <span className="opacity-50">·</span>
            <button
              className="underline-offset-2 hover:underline"
              onClick={() => navigate({ name: 'mod' })}
            >
              Fabric mod status
            </button>
          </div>
        </div>
      </footer>

      <SonnerToaster richColors position="top-right" />
    </div>
  );
}
