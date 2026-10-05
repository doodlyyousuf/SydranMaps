'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from './use-cart';
import { useRouter } from './router';
import { PixelArt } from './pixel-art';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Coins,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  formatPrice,
  formatPriceFull,
  sizeLabel,
  type OrderView,
} from '@/lib/sydran';

export function CartView() {
  const { lines, total, totalMaps, count, setQuantity, remove, clear, hydrated } = useCart();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [player, setPlayer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderView | null>(null);

  const handleCheckout = async () => {
    if (player.trim().length < 3) {
      toast({
        title: 'Username required',
        description: 'Enter your Minecraft username (min 3 chars).',
        variant: 'destructive',
      });
      return;
    }
    if (lines.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: player.trim(),
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      setPlacedOrder(data.order);
      clear();
      toast({
        title: 'Order placed',
        description: `Order ${data.order.code} created. Pay ${formatPrice(data.order.totalAmount)} in-game to confirm.`,
      });
    } catch (e) {
      toast({
        title: 'Checkout failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Confirmation screen ────────────────────────────────────────────
  if (placedOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-3 font-pixel text-2xl font-bold">Order placed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your order has been created and is awaiting in-game payment.
          </p>

          <div className="mt-5 rounded-xl border border-border bg-card p-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Order code
                </div>
                <div className="font-pixel text-xl font-bold">{placedOrder.code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount due
                </div>
                <div className="coin-tag inline-block px-2.5 py-1 font-pixel text-lg font-bold">
                  {formatPrice(placedOrder.totalAmount)}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm">
              <div className="font-medium">Payment instructions</div>
              <p className="mt-1 text-muted-foreground">
                Send exactly{' '}
                <code className="font-mono text-foreground">
                  {formatPriceFull(placedOrder.totalAmount)}
                </code>{' '}
                in-game to the Sydran Maps shop account. The payment matcher
                will detect your transfer and mark this order as{' '}
                <span className="font-medium text-foreground">Paid</span>.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate({ name: 'order', code: placedOrder.code })}>
              View order
            </Button>
            <Button variant="outline" onClick={() => navigate({ name: 'gallery' })}>
              Continue shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Cart screen ────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </button>

      <h1 className="font-pixel text-2xl font-bold sm:text-3xl">Your cart</h1>

      {lines.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Button className="mt-4" onClick={() => navigate({ name: 'gallery' })}>
            Browse the gallery
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {lines.map((l) => (
            <div
              key={l.productId}
              className="flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md">
                <PixelArt svg={l.previewSvg} alt={l.productName} aspect="square" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{l.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      <code className="font-mono">{l.productCode}</code> ·{' '}
                      {sizeLabel(l.width, l.height)} · {l.totalMaps} maps
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-pixel text-sm font-bold text-accent"
                    >
                      {formatPrice(l.unitPrice * l.quantity)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatPrice(l.unitPrice)} each
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-md border border-border">
                    <button
                      onClick={() => setQuantity(l.productId, l.quantity - 1)}
                      className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {l.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(l.productId, l.quantity + 1)}
                      className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-foreground"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(l.productId)}
                    className="text-muted-foreground hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={clear}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear cart
          </button>

          {/* Totals */}
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Total map tiles
              </span>
              <span>{totalMaps}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="coin-tag inline-block px-2.5 py-1 font-pixel text-lg font-bold">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          {/* Checkout */}
          <div className="rounded-xl border border-border bg-card p-4">
            <Label htmlFor="player" className="text-xs uppercase tracking-wider">
              Minecraft username
            </Label>
            <Input
              id="player"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="e.g. Doodly_yousuf"
              className="mt-1.5"
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              <AlertCircle className="inline h-3 w-3" /> Use the exact same
              username that will send the in-game payment.
            </p>

            <Button
              onClick={handleCheckout}
              size="lg"
              disabled={submitting || lines.length === 0}
              className="mt-4 w-full gap-2 font-pixel"
            >
              <Coins className="h-4 w-4" />
              {submitting ? 'Placing order…' : `Place order · ${formatPrice(total)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
