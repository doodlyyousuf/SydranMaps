'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapCard } from './map-card';
import { PixelArt } from './pixel-art';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generatePreviewSvg } from '@/lib/pixel-art';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIES, categoryLabel, formatPrice, type ProductView } from '@/lib/sydran';
import { useRouter } from './router';
import { Search, SlidersHorizontal, Sparkles, Shield, Layers, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryViewProps {
  onPickCategory?: (c: string) => void;
  initialCategory?: string;
}

export function GalleryView({ initialCategory = 'all' }: GalleryViewProps) {
  const { navigate } = useRouter();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [size, setSize] = useState('all');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');
  // Quick order-code lookup, e.g. "MAP-1042". Used by the delivery team
  // to jump straight to an order without scrolling the queue.
  const [orderLookup, setOrderLookup] = useState('');

  const submitOrderLookup = () => {
    const code = orderLookup.trim().toUpperCase();
    if (!code) return;
    // Allow input with or without the MAP- prefix.
    const normalized = code.startsWith('MAP-') ? code : `MAP-${code}`;
    navigate({ name: 'order', code: normalized });
  };

  useEffect(() => {
    let cancelled = false;
    // Note: we intentionally do NOT setLoading(true) here — the previous
    // results stay visible while the new fetch is in flight, avoiding
    // a flicker to skeleton on every filter change. Initial load uses
    // loading=true from useState default, then transitions to false once.
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (size && size !== 'all') params.set('size', size);
    if (sort) params.set('sort', sort);
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, size, sort, q]);

  const featured = useMemo(() => {
    // Pick the largest map (most tiles) as the showcase.
    if (products.length === 0) return null;
    return [...products].sort((a, b) => b.totalMaps - a.totalMaps)[0];
  }, [products]);

  // Generate the hero panorama client-side from the featured product.
  // For 1×1 products this falls back to the thumbnail; for large maps
  // it produces the full multi-tile SVG. Done in useMemo so it only
  // re-computes when `featured` changes.
  const heroPanorama = useMemo(() => {
    if (!featured) return '';
    if (featured.width <= 1 && featured.height <= 1) return featured.previewSvg;
    return generatePreviewSvg({
      name: featured.name,
      category: featured.category,
      width: featured.width,
      height: featured.height,
      showTileGrid: false,
    });
  }, [featured]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* ─── HERO — big map-art splash ─────────────────────────────────── */}
      {featured ? (
        <section className="relative -mx-4 mb-8 overflow-hidden sm:-mx-6">
          {/* Full-bleed pixel-art panorama */}
          <button
            onClick={() => navigate({ name: 'product', id: featured.code })}
            className="block w-full text-left"
            aria-label={`Open featured product: ${featured.name}`}
          >
            <div className="relative aspect-[16/8] min-h-[280px] w-full overflow-hidden bg-background">
              <PixelArt
                svg={heroPanorama || featured.previewSvg}
                alt={`${featured.name} panorama`}
                aspect="auto"
                className="absolute inset-0 h-full w-full item-glow"
              />
              {/* Dark vignette overlay so text is readable */}
              <div className="hero-vignette absolute inset-0" />
              {/* Faint pixel-grid overlay to reinforce the map-tile structure */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.5) 1px, transparent 1px)',
                  backgroundSize: `${100 / featured.width}% ${100 / featured.height}%`,
                }}
              />

              {/* Headline + CTA — bottom-left, over the dark gradient */}
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 inline-flex items-center gap-1.5 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-sm slot-border">
                      <Sparkles className="h-3 w-3" />
                      Featured · {featured.width}×{featured.height}
                    </div>
                    <h1 className="font-pixel text-2xl font-bold text-foreground drop-shadow-lg sm:text-4xl lg:text-5xl">
                      {featured.name}
                    </h1>
                    <p className="mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
                      {featured.totalMaps} hand-aligned tiles of pixel-art.
                      Built in survival Minecraft, delivered to your base.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="font-pixel uppercase tracking-wider slot-border"
                      >
                        <a href={`#/product/${featured.code}`}>
                          View this map
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <span className="coin-tag inline-flex items-center rounded-sm px-2.5 py-1 font-pixel text-xs font-bold">
                        {formatPrice(featured.price)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </section>
      ) : (
        <section className="mb-8 -mx-4 px-4 pt-8 pb-12 text-center sm:-mx-6 sm:px-6">
          <h1 className="font-pixel text-3xl font-bold sm:text-4xl">
            Hand-crafted Minecraft map-art
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Loading the gallery…
          </p>
        </section>
      )}

      {/* ─── Quick order lookup (delivery team shortcut) ───────────────── */}
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Input
            value={orderLookup}
            onChange={(e) => setOrderLookup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitOrderLookup()}
            placeholder="Lookup order MAP-1042…"
            className="h-9 max-w-xs font-mono text-sm"
            aria-label="Quick order lookup"
            autoComplete="off"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={submitOrderLookup}
            disabled={orderLookup.trim().length < 3}
            className="gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Open
          </Button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 bg-card/60 px-2.5 py-1 text-muted-foreground slot-border">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            Duplicate-protected
          </span>
          <span className="inline-flex items-center gap-1.5 bg-card/60 px-2.5 py-1 text-muted-foreground slot-border">
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            1×1 → 10×6
          </span>
        </div>
      </section>

      {/* ─── Filter bar ───────────────────────────────────────────── */}
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search map-art by name…"
            className="pl-9"
            aria-label="Search products"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger size="sm" className="w-[150px]" aria-label="Category filter">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={size} onValueChange={setSize}>
            <SelectTrigger size="sm" className="w-[120px]" aria-label="Size filter">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              <SelectItem value="1x1">1×1</SelectItem>
              <SelectItem value="2x2">2×2</SelectItem>
              <SelectItem value="5x3">5×3</SelectItem>
              <SelectItem value="10x6">10×6</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger size="sm" className="w-[140px]" aria-label="Sort">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low → high</SelectItem>
              <SelectItem value="price_desc">Price: high → low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ─── Gallery grid — Phase 16 spec ────────────────────────── */}
      <section>
        {loading ? (
          <div className="sydran-gallery-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              No map-art matches your filters.
            </p>
          </div>
        ) : (
          <div className="sydran-gallery-grid">
            {products.map((p) => (
              <MapCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
