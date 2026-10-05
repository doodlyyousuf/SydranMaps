'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from './status-badge';
import { PixelArt } from './pixel-art';
import { useRouter } from './router';
import { useToast } from '@/hooks/use-toast';
import {
  formatPrice,
  sizeLabel,
  type OrderStatus,
} from '@/lib/sydran';
import {
  RefreshCw,
  Truck,
  Hand,
  CheckCircle2,
  Layers,
  Filter,
  Search,
  Package2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueItem {
  id: string;
  code: string;
  player: string;
  status: string;
  totalAmount: number;
  totalMaps: number;
  mapBreakdown: Record<string, number>;
  items: Array<{
    productCode: string;
    productName: string;
    productPreviewSvg: string;
    quantity: number;
    unitPrice: number;
    width: number;
    height: number;
    tileCount: number;
  }>;
  claimedBy: string | null;
  claimedAt: string | null;
  deliveredBy: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export function DeliveryQueue() {
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [deliveredHistory, setDeliveredHistory] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    paid: number;
    claimed: number;
    delivered: number;
    mapsToDeliver: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | OrderStatus>('active');
  const [assignedTo, setAssignedTo] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'active') params.set('status', statusFilter);
    if (assignedTo.trim()) params.set('assignedTo', assignedTo.trim());
    fetch(`/api/delivery/queue?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.queue ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(() => {
        setItems([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, assignedTo]);

  // Load delivered-history in parallel (separate request so the active
  // queue filter doesn't hide delivered orders).
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    fetch('/api/delivery/queue?status=delivered')
      .then((r) => r.json())
      .then((data) => setDeliveredHistory(data.queue ?? []))
      .catch(() => setDeliveredHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadHistory();
  }, [load, loadHistory]);

  const call = async (code: string, path: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(code)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      toast({
        title: 'Updated',
        description: `Order ${data.order.code} → ${data.order.status.toUpperCase()}`,
      });
      load();
      loadHistory();
    } catch (e) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-2xl font-bold sm:text-3xl">Delivery queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live orders awaiting delivery. Claim, deliver, and track every
            map tile here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* ── Summary tiles ─────────────────────────────────────────── */}
      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile
            icon={Package2}
            label="Active in queue"
            value={summary.paid + summary.claimed}
            color="text-amber-300"
          />
          <SummaryTile
            icon={Hand}
            label="Claimed"
            value={summary.claimed}
            color="text-violet-300"
          />
          <SummaryTile
            icon={CheckCircle2}
            label="Delivered"
            value={summary.delivered}
            color="text-emerald-300"
          />
          <SummaryTile
            icon={Layers}
            label="Maps to deliver"
            value={summary.mapsToDeliver}
            color="text-sky-300"
          />
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as never)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Status filter"
          >
            <option value="active">Active delivery (paid + claimed)</option>
            <option value="paid">Paid only</option>
            <option value="claimed">Claimed only</option>
            <option value="delivered">Delivered (history)</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Filter by claimant…"
            className="pl-9"
            aria-label="Filter by claimant"
          />
        </div>
      </div>

      {/* ── Queue list ────────────────────────────────────────────── */}
      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No orders in this view.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <QueueRow key={it.id} item={it} onOpen={() => navigate({ name: 'order', code: it.code })} onAction={call} />
          ))}
        </div>
      )}

      {/* ── Recent deliveries — Phase 1: delivered orders remain visible ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-pixel text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-400" />
            Recent deliveries
          </h2>
          <span className="text-xs text-muted-foreground">
            {deliveredHistory.length} completed
          </span>
        </div>

        {historyLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : deliveredHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No deliveries yet — claimed orders will appear here once marked delivered.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {deliveredHistory.slice(0, 8).map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => navigate({ name: 'order', code: it.code })}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-left text-sm hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <code className="w-24 shrink-0 font-mono text-xs">{it.code}</code>
                  <span className="w-32 truncate">{it.player}</span>
                  <span className="hidden flex-1 truncate text-xs text-muted-foreground sm:block">
                    {Object.entries(it.mapBreakdown)
                      .map(([size, qty]) => `${size} × ${qty}`)
                      .join(', ')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by <strong className="text-emerald-300">{it.deliveredBy}</strong>
                  </span>
                  <span className="ml-auto w-16 text-right text-xs font-medium text-accent">
                    {formatPrice(it.totalAmount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QueueRow({
  item,
  onOpen,
  onAction,
}: {
  item: QueueItem;
  onOpen: () => void;
  onAction: (code: string, path: string, body: Record<string, unknown>) => void;
}) {
  const [actor, setActor] = useState('');

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpen}
              className="font-pixel text-base font-bold hover:underline"
            >
              {item.code}
            </button>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            Player: <span className="font-medium text-foreground">{item.player}</span>
          </div>

          {/* Map breakdown — Phase 8 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Object.entries(item.mapBreakdown).map(([size, qty]) => (
              <span
                key={size}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium"
              >
                <Layers className="h-3 w-3 text-violet-400" />
                {size} × {qty}
              </span>
            ))}
            <span className="text-[11px] text-muted-foreground">
              · {item.totalMaps} {item.totalMaps === 1 ? 'map' : 'maps'} total
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="font-pixel text-lg font-bold text-accent">
            {formatPrice(item.totalAmount)}
          </div>
        </div>
      </div>

      {/* Item previews */}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-1.5"
            title={`${it.productName} — ${it.width}×${it.height} · ${it.tileCount} maps`}
          >
            <div className="h-9 w-9 overflow-hidden rounded">
              <PixelArt svg={it.productPreviewSvg} alt={it.productName} aspect="square" />
            </div>
            <div className="pr-1">
              <div className="max-w-[120px] truncate text-xs font-medium">{it.productName}</div>
              <div className="text-[10px] text-muted-foreground">
                {sizeLabel(it.width, it.height)} · {it.tileCount} maps
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Claim info / actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {item.status === 'claimed' && (
            <span>
              Claimed by <strong className="text-violet-300">{item.claimedBy}</strong>{' '}
              · {item.claimedAt && new Date(item.claimedAt).toLocaleString()}
            </span>
          )}
          {item.status === 'delivered' && (
            <span>
              Delivered by <strong className="text-emerald-300">{item.deliveredBy}</strong>{' '}
              · {item.deliveredAt && new Date(item.deliveredAt).toLocaleString()}
            </span>
          )}
          {item.status === 'paid' && <span>Awaiting claim from delivery team.</span>}
          {item.status === 'awaiting_payment' && <span>Awaiting in-game payment.</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {item.status === 'paid' && (
            <>
              <Input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="Your username"
                className="h-8 w-36 text-xs"
                autoComplete="off"
              />
              <Button
                size="sm"
                onClick={() => onAction(item.code, 'claim', { claimedBy: actor })}
                disabled={actor.trim().length < 3}
                className="gap-1.5"
              >
                <Hand className="h-3 w-3" />
                Claim
              </Button>
            </>
          )}
          {item.status === 'claimed' && (
            <>
              <Input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder={`Confirm as ${item.claimedBy ?? ''}`}
                className="h-8 w-44 text-xs"
                autoComplete="off"
              />
              <Button
                size="sm"
                onClick={() => onAction(item.code, 'deliver', { deliveredBy: actor })}
                disabled={actor.trim().length < 3}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark delivered
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(item.code, 'unclaim', { requestedBy: actor })}
                disabled={actor.trim().length < 3}
              >
                Unclaim
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpen}
            className="text-xs"
          >
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
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
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className="mt-1 font-pixel text-2xl font-bold">{value}</div>
    </div>
  );
}
