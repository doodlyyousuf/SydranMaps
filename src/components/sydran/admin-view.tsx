'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { StatusBadge } from './status-badge';
import { useRouter } from './router';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, sizeLabel } from '@/lib/sydran';
import { PixelArt } from './pixel-art';
import {
  RefreshCw,
  Database,
  Package,
  ShoppingCart,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import type { OrderView, ProductView } from '@/lib/sydran';

export function AdminView() {
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [reseeding, setReseeding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/orders').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ])
      .then(([o, p]) => {
        setOrders(o.orders ?? []);
        setProducts(p.products ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reseed = async () => {
    setReseeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Seed failed');
      toast({
        title: 'Demo data reset',
        description: 'Database re-seeded with sample products + orders.',
      });
      load();
    } catch (e) {
      toast({
        title: 'Seed failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setReseeding(false);
    }
  };

  // Quick stats
  const totalMaps = products.reduce((s, p) => s + p.totalMaps, 0);
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const activeCount = orders.filter((o) => o.status === 'paid' || o.status === 'claimed').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-2xl font-bold sm:text-3xl">Admin overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All products + orders at a glance. Reset the demo data any time.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={reseeding}
              className="gap-1.5"
            >
              {reseeding ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              Reset demo data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will wipe every product, order, and mod-config row
                and re-seed the database with the sample Sydran Maps
                dataset. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={reseed}
                className="bg-rose-600 text-white hover:bg-rose-500"
              >
                {reseeding ? 'Resetting…' : 'Yes, reset'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Stats tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Package} label="Products" value={products.length} color="text-primary" />
        <Stat icon={Layers} label="Total tiles" value={totalMaps} color="text-violet-300" />
        <Stat icon={ShoppingCart} label="Active orders" value={activeCount} color="text-amber-300" />
        <Stat icon={CheckCircle2} label="Delivered" value={deliveredCount} color="text-emerald-300" />
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Orders table */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-pixel text-sm font-bold uppercase tracking-wider">
              Orders
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {orders.slice(0, 12).map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => navigate({ name: 'order', code: o.code })}
                      className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted/40"
                    >
                      <code className="w-20 shrink-0 font-mono text-xs">{o.code}</code>
                      <span className="w-28 truncate text-sm">{o.player}</span>
                      <span className="flex-1 text-xs text-muted-foreground">
                        {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                      </span>
                      <StatusBadge status={o.status} pulse={false} />
                      <span className="ml-auto w-16 text-right text-xs font-medium text-accent">
                        {formatPrice(o.totalAmount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Products grid */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-pixel text-sm font-bold uppercase tracking-wider">
              Products
            </h2>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {products.slice(0, 9).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate({ name: 'product', id: p.code })}
                      className="flex w-full flex-col gap-1.5 rounded-md border border-transparent p-1.5 text-left hover:border-border hover:bg-muted/30"
                    >
                      <div className="aspect-square overflow-hidden rounded-md">
                        <PixelArt svg={p.previewSvg} alt={p.name} aspect="square" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{p.name}</div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{sizeLabel(p.width, p.height)}</span>
                          <span className="font-medium text-accent">{formatPrice(p.price)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color ?? ''}`} />
        {label}
      </div>
      <div className="mt-1 font-pixel text-2xl font-bold">{value}</div>
    </div>
  );
}
