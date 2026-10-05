'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapCard } from './map-card';
import { PixelArt } from './pixel-art';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIES, categoryLabel, formatPrice, type ProductView } from '@/lib/sydran';
import { Search, SlidersHorizontal, Sparkles, Shield, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryViewProps {
  onPickCategory?: (c: string) => void;
  initialCategory?: string;
}

export function GalleryView({ initialCategory = 'all' }: GalleryViewProps) {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [size, setSize] = useState('all');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="mb-8 grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <Sparkles className="h-3 w-3" />
            <span>Phase 1–9 redesign · live</span>
          </div>
          <h1 className="mt-3 font-pixel text-3xl font-bold leading-tight sm:text-4xl">
            Hand-crafted Minecraft map-art
          </h1>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
            Every piece is built tile-by-tile in survival Minecraft. From
            single-map portraits to massive 10×6 panoramas of sixty
            hand-aligned tiles — order, pay in-game, and a real delivery
            member brings it to your base. No bots, ever.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              Server-side duplicate detection
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              Supports 1×1 to 10×6
            </span>
          </div>
        </div>

        {/* Featured large-map showcase */}
        {featured && (
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Featured
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: featured.accentColor }}
              >
                {formatPrice(featured.price)}
              </span>
            </div>
            <PixelArt
              svg={featured.previewSvg}
              alt={featured.name}
              aspect="wide"
              className="rounded-lg"
            />
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{featured.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {featured.width}×{featured.height} · {featured.totalMaps} maps
                </div>
              </div>
              <Button
                asChild
                size="sm"
                className="font-pixel"
              >
                <a href={`#/product/${featured.code}`}>View</a>
              </Button>
            </div>
          </div>
        )}
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
