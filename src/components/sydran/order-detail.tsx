'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from './status-badge';
import { PixelArt } from './pixel-art';
import { useRouter, orderHref } from './router';
import { useToast } from '@/hooks/use-toast';
import {
  formatPrice,
  formatPriceFull,
  sizeLabel,
  ORDER_STATUS_ORDER,
  type OrderView,
  type OrderStatus,
} from '@/lib/sydran';
import {
  ArrowLeft,
  Copy,
  Hash,
  User,
  Coins,
  Package,
  Hand,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function OrderDetail({ orderCode }: { orderCode: string }) {
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState(''); // delivery member username input
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/orders/${encodeURIComponent(orderCode)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        setOrder(d.order);
        setError(null);
      })
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [orderCode]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Lifecycle actions ────────────────────────────────────────────
  const call = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // 401 → tell them to go to /#/admin (there's no visible login button).
      // The order page itself is public, but claim/deliver/simulate-payment
      // require staff auth. We don't auto-redirect because that would expose
      // the admin URL pattern to anyone who clicks the buttons.
      if (res.status === 401) {
        toast({
          title: 'Sign in required',
          description: 'Open /#/admin in your browser and enter your PIN to perform this action.',
          variant: 'destructive',
        });
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      setOrder(data.order);
      toast({
        title: 'Updated',
        description: `Order ${data.order.code} → ${data.order.status.toUpperCase()}`,
      });
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };


  const copyOrderLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/${orderHref(orderCode)}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Order link copied',
      description: url,
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Skeleton className="mb-4 h-7 w-32" />
        <Skeleton className="mb-3 h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <p className="text-muted-foreground">
          Could not find order <code className="font-mono">{orderCode}</code>.
        </p>
        <Button className="mt-4" onClick={() => navigate({ name: 'gallery' })}>
          Back to gallery
        </Button>
      </div>
    );
  }

  const { product, tiles } = data;
  const maps = totalMaps(product.width, product.height);
  const isLarge = product.width > 1 || product.height > 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </button>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              <span className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3" />{' '}
                {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>
            <h1 className="mt-1.5 font-pixel text-2xl font-bold sm:text-3xl">
              {order.code}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {order.player}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Total
            </div>
            <div className="coin-tag inline-block px-2.5 py-1 font-pixel text-xl font-bold">
              {formatPrice(order.totalAmount)}
            </div>
          </div>
        </div>

        {/* ── Items list ─────────────────────────────────────────────── */}
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4" />
            Items ({order.items.length})
          </h2>
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-3 rounded-lg border border-border bg-muted/20 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {sizeLabel(it.width, it.height)} · {it.width * it.height} maps × {it.quantity}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-accent">
                    {formatPrice(it.unitPrice * it.quantity)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── Order actions ──────────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Hand className="h-4 w-4" />
          Order actions
        </h2>

        {order.status === 'awaiting_payment' && (
          <div className="rounded-md bg-amber-500/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-300">
              <Coins className="h-4 w-4" />
              Awaiting payment
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Run this command in-game to pay{' '}
              <strong className="text-foreground">
                {formatPriceFull(order.totalAmount)}
              </strong>:
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-[3px] border-[1.5px] border-primary bg-primary p-2.5 text-primary-foreground">
              <code className="font-mono text-sm break-all">
                /pay doodly_yousuf {order.totalAmount}
              </code>
              <button
                onClick={() => {
                  const cmd = `/pay doodly_yousuf ${order.totalAmount}`;
                  navigator.clipboard.writeText(cmd);
                  toast({ title: 'Copied', description: cmd });
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-[oklch(0.5_0.025_65)] px-2.5 py-1 text-xs hover:border-primary-foreground"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>
        )}

        {/* ── Create /order instructions — shown after payment is matched ──
            On DonutSMP, customers create an /order for the number of maps
            they bought at $1 each. The delivery member delivers the maps
            directly into that order — no base coordinates needed. */}
        {(order.status === 'paid' || order.status === 'claimed') && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Package className="h-4 w-4" />
              Create your in-game order
            </div>
            <p className="text-xs text-muted-foreground">
              After your payment is verified, create an in-game order for{' '}
              <strong className="text-foreground">{totalMaps} {totalMaps === 1 ? 'map' : 'maps'}</strong>{' '}
              at <strong className="text-foreground">$1 each</strong>. The delivery
              member will deliver the maps directly into your order.
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-[3px] border-[1.5px] border-primary bg-primary p-2.5 text-primary-foreground">
              <code className="font-mono text-sm">/order {order.player}</code>
              <button
                onClick={() => {
                  const cmd = `/order ${order.player}`;
                  navigator.clipboard.writeText(cmd);
                  toast({ title: 'Copied', description: cmd });
                }}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-[oklch(0.5_0.025_65)] px-2.5 py-1 text-xs hover:border-primary-foreground"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Run this in-game after claiming the order from in-game chat.
              The maps will appear in your /order inventory.
            </p>
          </div>
        )}

        {order.status === 'paid' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              A delivery member can claim this order. Only the claimant can
              unclaim or mark as delivered.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="order-claim-input"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="Delivery member username"
                className="sm:max-w-xs"
                autoComplete="off"
              />
              <Button
                onClick={() => call('claim', { claimedBy: actor })}
                disabled={busy || actor.trim().length < 3}
                className="gap-1.5"
              >
                <Hand className="h-3.5 w-3.5" />
                Claim order
              </Button>
            </div>
          </div>
        )}

        {order.status === 'claimed' && (
          <div className="space-y-3">
            <div className="rounded-md bg-violet-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-violet-300">
                <Truck className="h-4 w-4" />
                Claimed by {order.claimedBy}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Claimed at {new Date(order.claimedAt ?? order.createdAt).toLocaleString()}.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder={`Confirm as ${order.claimedBy ?? 'claimant'}`}
                className="sm:max-w-xs"
                autoComplete="off"
              />
              <Button
                onClick={() => call('deliver', { deliveredBy: actor })}
                disabled={busy || actor.trim().length < 3}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as delivered
              </Button>
              <Button
                variant="outline"
                onClick={() => call('unclaim', { requestedBy: actor })}
                disabled={busy || actor.trim().length < 3}
                className="gap-1.5"
              >
                Unclaim
              </Button>
            </div>
          </div>
        )}

        {order.status === 'delivered' && (
          <div className="rounded-md bg-emerald-500/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Delivered
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Delivered by <strong>{order.deliveredBy}</strong> at{' '}
              {new Date(order.deliveredAt ?? order.createdAt).toLocaleString()}.
              This order is locked and remains in delivery history.
            </p>
          </div>
        )}

        {order.status === 'cancelled' && (
          <div className="rounded-md bg-rose-500/10 p-3 text-sm text-rose-300">
            This order was cancelled.
          </div>
        )}

        {order.note && (
          <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs">
            <span className="font-medium">Note:</span>{' '}
            <span className="text-muted-foreground">{order.note}</span>
          </div>
        )}
      </section>

      {/* ── Metadata ─────────────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border border-border bg-card/60 p-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Meta icon={Hash} label="Code" value={order.code} />
          <Meta icon={User} label="Player" value={order.player} />
          <Meta icon={Coins} label="Payment ref" value={order.paymentRef ?? '—'} />
          <Meta icon={Clock} label="Matched at" value={order.paymentMatchedAt ? new Date(order.paymentMatchedAt).toLocaleString() : '—'} />
          <Meta icon={Hand} label="Claimed by" value={order.claimedBy ?? '—'} />
          <Meta icon={Clock} label="Claimed at" value={order.claimedAt ? new Date(order.claimedAt).toLocaleString() : '—'} />
          <Meta icon={CheckCircle2} label="Delivered by" value={order.deliveredBy ?? '—'} />
          <Meta icon={Clock} label="Delivered at" value={order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'} />
        </div>
      </section>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm">{value}</div>
    </div>
  );
}
