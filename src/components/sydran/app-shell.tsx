'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, routeToHash } from './router';
import { useCart } from './use-cart';
import { Button } from '@/components/ui/button';
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
      <header className="sticky top-0 z-40 border-b-2 border-background/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link
            href={routeToHash({ name: 'gallery' })}
            className="group flex items-center gap-2.5"
          >
            {/* Minecraft-style pixel logo block */}
            <span className="grid h-9 w-9 place-items-center bg-primary text-primary-foreground slot-border group-hover:slot-border-raised">
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

          {/* Desktop nav — slot-styled buttons */}
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = route.name === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate({ name: item.name })}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 font-pixel text-[11px] font-bold uppercase tracking-wider transition-colors slot-border',
                    active
                      ? 'bg-primary/15 text-primary hover:slot-border-raised'
                      : 'bg-card/60 text-muted-foreground hover:text-foreground hover:slot-border-raised'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative gap-1.5 slot-border hover:slot-border-raised"
              onClick={() => navigate({ name: 'cart' })}
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden font-pixel text-[11px] uppercase tracking-wider sm:inline">Cart</span>
              {hydrated && count > 0 && (
                <span className="coin-tag ml-1 inline-flex h-5 min-w-5 items-center justify-center px-1.5 font-pixel text-[10px] font-bold">
                  {count}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-background/80 px-4 py-2 md:hidden sydran-scroll">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = route.name === item.name;
            return (
              <button
                key={item.name}
                onClick={() => navigate({ name: item.name })}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-pixel text-[11px] font-bold uppercase tracking-wider transition-colors slot-border',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-card/60 text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main>{children}</main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="mt-12 border-t-2 border-background/80 bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="grid h-6 w-6 place-items-center bg-primary text-primary-foreground slot-border">
              <Map className="h-3 w-3" />
            </span>
            <span className="font-pixel text-[11px] uppercase tracking-wider">Sydran Maps</span>
            <span className="opacity-50">·</span>
            <span>Map-art marketplace</span>
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
