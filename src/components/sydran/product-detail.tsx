'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Layers,
  Shield,
  ShoppingCart,
  Hash,
  Tag,
  Ruler,
  Calendar,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import {
  formatPrice,
  formatPriceFull,
  sizeLabel,
  totalMaps,
  categoryLabel,
  type ProductView,
} from '@/lib/sydran';
import { generateTilePreviewSvg, generatePreviewSvg } from '@/lib/pixel-art';
import { PixelArt } from './pixel-art';
import { useRouter } from './router';
import { useCart } from './use-cart';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProductViewResponse {
  product: ProductView;
  tiles: Array<{ id: string; posX: number; posY: number; tileHash: string }>;
}

export function ProductDetail({ productCode }: { productCode: string }) {
  const { navigate } = useRouter();
  const { add } = useCart();
  const { toast } = useToast();
  const [data, setData] = useState<ProductViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTiles, setShowTiles] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderTiles, setReorderTiles] = useState<Array<{ id: string; posX: number; posY: number; tileHash: string }>>([]);
  const [savingReorder, setSavingReorder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Fetch the product. We don't setLoading(true) here because the parent
    // uses a `key={productCode}` prop to remount this component on every
    // product change, so the initial useState(true) gives us the loading
    // state automatically.
    fetch(`/api/products/${encodeURIComponent(productCode)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productCode]);

  // Pre-compute per-tile SVG previews. Each tile renders distinct pixels
  // because the seed includes posX/posY. Memoized so re-renders don't
  // redo the work. Called unconditionally (before any early return) so
  // React's rules-of-hooks are satisfied.
  const tileSvgs = useMemo(() => {
    const m = new Map<string, string>();
    if (!data) return m;
    for (const t of data.tiles) {
      m.set(
        t.id,
        generateTilePreviewSvg({
          productName: data.product.name,
          category: data.product.category,
          posX: t.posX,
          posY: t.posY,
        })
      );
    }
    return m;
  }, [data]);

  // Generate the full multi-tile panorama on the client (only for large
  // maps). For 1×1 products we just use the stored thumbnail SVG. This
  // keeps the gallery API small (each product's stored previewSvg is a
  // single-tile thumbnail) while still showing a real panorama on the
  // detail page.
  const panoramaSvg = useMemo(() => {
    if (!data) return '';
    const { product } = data;
    if (product.width <= 1 && product.height <= 1) return product.previewSvg;
    return generatePreviewSvg({
      name: product.name,
      category: product.category,
      width: product.width,
      height: product.height,
      showTileGrid: true,
    });
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Skeleton className="mb-4 h-8 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <p className="text-muted-foreground">
          Could not find product <code className="font-mono">{productCode}</code>.
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

  const handleAdd = () => {
    add({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unitPrice: product.price,
      width: product.width,
      height: product.height,
      totalMaps: maps,
      previewSvg: product.previewSvg,
    });
    toast({
      title: 'Added to cart',
      description: `${product.name} (${sizeLabel(product.width, product.height)}) is in your cart.`,
    });
    navigate({ name: 'cart' });
  };

  // ── Tile reorder handlers ────────────────────────────────────────
  const startReorder = () => {
    setReorderTiles(tiles.map((t) => ({ ...t })));
    setReorderMode(true);
    setShowTiles(true);
  };

  const swapTiles = (id1: string, id2: string) => {
    setReorderTiles((prev) => {
      const next = [...prev];
      const i1 = next.findIndex((t) => t.id === id1);
      const i2 = next.findIndex((t) => t.id === id2);
      if (i1 < 0 || i2 < 0) return prev;
      const tmpX = next[i1].posX;
      const tmpY = next[i1].posY;
      next[i1] = { ...next[i1], posX: next[i2].posX, posY: next[i2].posY };
      next[i2] = { ...next[i2], posX: tmpX, posY: tmpY };
      return next;
    });
  };

  const saveReorder = async () => {
    if (!product) return;
    setSavingReorder(true);
    try {
      const res = await fetch(`/api/products/${product.code}/reorder-tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiles: reorderTiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reorder failed');
      toast({ title: 'Tiles rearranged', description: `Saved ${reorderTiles.length} tile positions.` });
      setReorderMode(false);
      window.location.reload();
    } catch (e) {
      toast({
        title: 'Reorder failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingReorder(false);
    }
  };

  const cancelReorder = () => {
    setReorderMode(false);
    setReorderTiles([]);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <button
        onClick={() => navigate({ name: 'gallery' })}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </button>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] lg:gap-8">
        {/* ── Preview panel ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <PixelArt
              svg={panoramaSvg || product.previewSvg}
              alt={product.name}
              aspect={isLarge ? 'wide' : 'square'}
            />
            {/* Map size badge overlay */}
            <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-background/85 px-2 py-1 text-xs font-semibold ring-1 ring-border/50 backdrop-blur">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              {sizeLabel(product.width, product.height)} · {maps} {maps === 1 ? 'map' : 'maps'}
            </div>
          </div>

          {/* Toggle to show individual tiles + rearrange (Phase 15) */}
          {isLarge && (
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex w-full items-center justify-between">
                <button
                  onClick={() => setShowTiles((v) => !v)}
                  className="inline-flex items-center gap-2 text-sm font-medium"
                >
                  <Layers className="h-4 w-4" />
                  Tile breakdown
                  <span className="text-xs text-muted-foreground">
                    ({showTiles ? 'Hide' : 'Show'} {tiles.length} tiles)
                  </span>
                </button>

                {/* Reorder toggle — only show when tiles are visible + not already reordering */}
                {showTiles && !reorderMode && (
                  <button
                    onClick={startReorder}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    Rearrange tiles
                  </button>
                )}

                {/* Save/Cancel when reordering */}
                {reorderMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={saveReorder}
                      disabled={savingReorder}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      {savingReorder ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelReorder}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-rose-500 hover:text-rose-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {showTiles && !reorderMode && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Each square is one Minecraft map ({product.width}×{product.height} ={' '}
                  <strong className="text-foreground">{maps}</strong> tiles).
                  Hover to see position + fingerprint. Click "Rearrange tiles" to fix wrong order.
                </p>
              )}

              {showTiles && reorderMode && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong className="text-amber-500">Reorder mode:</strong> Click two tiles to swap their positions.
                  The grid shows where each tile will end up. Click "Save" when done.
                </p>
              )}

              {showTiles && (
                <div
                  className="mt-2 grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${product.width}, minmax(0, 1fr))`,
                  }}
                >
                  {/* In reorder mode, render reorderTiles; otherwise render original tiles */}
                  {(reorderMode ? reorderTiles : tiles).map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        'group relative aspect-square overflow-hidden rounded-sm bg-muted ring-1 ring-border/40',
                        !reorderMode && 'transition-transform hover:z-10 hover:scale-[1.15] hover:ring-primary',
                        reorderMode && 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-amber-500'
                      )}
                      title={`Tile (${t.posX}, ${t.posY}) — ${t.tileHash.slice(0, 12)}…`}
                      onClick={reorderMode ? () => {
                        // Simple swap: first click selects, second click swaps
                        const selected = reorderTiles.find(t2 => (t2 as any)._selected);
                        if (selected) {
                          swapTiles(selected.id, t.id);
                        } else {
                          setReorderTiles(prev => prev.map(t2 => t2.id === t.id ? { ...t2, _selected: true } as any : t2));
                        }
                      } : undefined}
                      style={reorderMode && (t as any)._selected ? { outline: '2px solid #f59e0b', outlineOffset: '1px' } : undefined}
                    >
                      <PixelArt
                        svg={tileSvgs.get(t.id) ?? ''}
                        alt={`Tile ${t.posX},${t.posY}`}
                        aspect="square"
                        className="absolute inset-0"
                      />
                      <span className="absolute bottom-0 left-0 right-0 truncate bg-background/85 px-1 text-[9px] font-mono text-muted-foreground backdrop-blur">
                        {t.posX},{t.posY}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Info panel ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {product.code}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {categoryLabel(product.category)}
              </Badge>
              {product.status === 'active' && (
                <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">
                  Active
                </Badge>
              )}
            </div>
            <h1 className="mt-2 font-pixel text-2xl font-bold sm:text-3xl">
              {product.name}
            </h1>
          </div>

          {/* Price block */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Price
                </div>
                <div
                  className="coin-tag inline-block px-3 py-1.5 font-pixel text-2xl font-bold sm:text-3xl"
                >
                  {formatPrice(product.price)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatPriceFull(product.price)}
                </div>
              </div>
              <Button
                onClick={handleAdd}
                size="lg"
                className="gap-2 font-pixel"
                disabled={product.status !== 'active'}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to cart
              </Button>
            </div>
          </div>

          {/* Spec block */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Spec icon={Ruler} label="Map size" value={sizeLabel(product.width, product.height)} />
            <Spec icon={Layers} label="Total tiles" value={`${maps}`} />
            <Spec icon={Tag} label="Category" value={categoryLabel(product.category)} />
          </div>

          {/* Description */}
          {product.description && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <h3 className="mb-1.5 text-sm font-semibold">About this map</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              {product.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {/* Fingerprint + duplicate info */}
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Duplicate fingerprint</div>
                <p className="text-xs text-muted-foreground">
                  Server-side SHA-256 fingerprint. Used to reject duplicate uploads
                  even if a mod re-uploads the same map.
                </p>
                <code className="mt-1.5 block truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground/80">
                  {product.mapHash ?? '—'}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 font-pixel text-sm font-semibold">{value}</div>
    </div>
  );
}
