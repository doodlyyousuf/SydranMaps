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

  const simulatePayment = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/simulate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: order.totalAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Payment simulation failed');
      setOrder(data.order);
      toast({
        title: 'Payment matched',
        description: `Order ${data.order.code} → PAID. Discord notification sent.`,
      });
    } catch (e) {
      toast({
        title: 'Payment failed',
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

  const totalMaps = order.items.reduce((s, it) => s + it.totalMaps, 0);

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
            <div className="font-pixel text-2xl font-bold text-accent">
              {formatPrice(order.totalAmount)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatPriceFull(order.totalAmount)}
            </div>
          </div>
        </div>

        {/* ── Lifecycle progress bar ─────────────────────────────── */}
        <div className="mt-4">
          <ol className="grid grid-cols-4 gap-1">
            {ORDER_STATUS_ORDER.map((s) => {
              const idx = ORDER_STATUS_ORDER.indexOf(s);
              const currentIdx = ORDER_STATUS_ORDER.indexOf(order.status as OrderStatus);
              const done = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <li
                  key={s}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider transition-colors',
                    done
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground',
                    isCurrent && 'ring-2 ring-primary/40 sydran-pulse'
                  )}
                >
                  {s.replace('_', ' ')}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Discord-style notification card (Phase 3 mock) */}
        {order.status === 'paid' && (
          <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-violet-300">
              <MessageSquare className="h-4 w-4" />
              💰 Payment Matched
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Sent to #delivery channel · {new Date(order.paymentMatchedAt ?? order.createdAt).toLocaleString()}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyOrderLink}
                className="gap-1.5"
              >
                <Copy className="h-3 w-3" />
                Copy order link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Items list ─────────────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" />
          Items ({order.items.length})
        </h2>
        <ul className="space-y-2">
          {order.items.map((it) => (
            <li
              key={it.id}
              className="flex gap-3 rounded-lg border border-border bg-muted/20 p-2"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md">
                <PixelArt svg={it.productPreviewSvg} alt={it.productName} aspect="square" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.productName}</div>
                <div className="text-xs text-muted-foreground">
                  <code className="font-mono">{it.productCode}</code> ·{' '}
                  {sizeLabel(it.width, it.height)} · {it.width * it.height} maps × {it.quantity}
                </div>
                <div className="mt-0.5 text-xs font-medium text-accent">
                  {formatPrice(it.unitPrice * it.quantity)}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Total tiles to deliver</span>
          <span className="font-semibold">{totalMaps}</span>
        </div>
      </section>

      {/* ── Lifecycle actions (Phase 1) ───────────────────────────── */}
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
              Send exactly{' '}
              <code className="font-mono text-foreground">
                {formatPriceFull(order.totalAmount)}
              </code>{' '}
              in-game. The payment matcher will detect the transfer and
              transition this order to <strong>Paid</strong>.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={simulatePayment}
              disabled={busy}
              className="mt-2 gap-1.5"
            >
              <RefreshCw className={cn('h-3 w-3', busy && 'animate-spin')} />
              Simulate payment match
            </Button>
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
                Only {order.claimedBy} can unclaim or mark as delivered.
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

      {/* ── Metadata block ───────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border border-border bg-card/60 p-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Meta icon={Hash} label="Code" value={order.code} />
          <Meta icon={User} label="Player" value={order.player} />
          <Meta
            icon={Coins}
            label="Payment ref"
            value={order.paymentRef ?? '—'}
          />
          <Meta
            icon={Clock}
            label="Matched at"
            value={order.paymentMatchedAt ? new Date(order.paymentMatchedAt).toLocaleString() : '—'}
          />
          <Meta
            icon={Hand}
            label="Claimed by"
            value={order.claimedBy ?? '—'}
          />
          <Meta
            icon={Clock}
            label="Claimed at"
            value={order.claimedAt ? new Date(order.claimedAt).toLocaleString() : '—'}
          />
          <Meta
            icon={CheckCircle2}
            label="Delivered by"
            value={order.deliveredBy ?? '—'}
          />
          <Meta
            icon={Clock}
            label="Delivered at"
            value={order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}
          />
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
