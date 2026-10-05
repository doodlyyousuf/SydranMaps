'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapCard } from './map-card';
import { PixelArt } from './pixel-art';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIES, categoryLabel, formatPrice, parsePrice, sizeLabel, type ProductView } from '@/lib/sydran';
import { generatePreviewSvg } from '@/lib/pixel-art';
import { useRouter } from './router';
import { useCart } from './use-cart';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  SlidersHorizontal,
  Shield,
  Layers,
  ArrowRight,
  ShoppingCart,
  CheckCircle2,
  Package,
  Coins,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const HOW_STEPS = [
  {
    title: 'Browse the catalog',
    body: 'Pick from single 1×1 maps up to massive 10×6 panoramas. Every piece is hand-built in survival Minecraft — no creative-mode cheats, no copy-paste.',
  },
  {
    title: 'Select your maps',
    body: 'Click any card to add it to your order. The selection tray at the bottom tracks your total and the number of map tiles you\u2019ll need delivered.',
  },
  {
    title: 'Place the order',
    body: 'Enter your Minecraft username and check out. The server creates an order code (MAP-XXXX) that you can share or bookmark.',
  },
  {
    title: 'Pay in-game & receive',
    body: 'Send the exact amount in-game. The payment matcher detects it automatically. Then create an /order for the number of maps at $1 each — a delivery member claims your order and delivers the maps directly in your /order. No bots, ever.',
  },
];

export function GalleryView() {
  const { navigate } = useRouter();
  const { add } = useCart();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [size, setSize] = useState('all');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');
  const [orderLookup, setOrderLookup] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (size && size !== 'all') params.set('size', size);
    if (sort) params.set('sort', sort);
    if (q.trim()) params.set('q', q.trim());
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProducts(data.products ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, size, sort, q]);

  // Featured = largest map (most tiles)
  const featured = useMemo(() => {
    if (products.length === 0) return null;
    return [...products].sort((a, b) => b.totalMaps - a.totalMaps)[0];
  }, [products]);

  // Showcase = top 3 widest multi-tile products for the hero
  const showcase = useMemo(() => {
    return products
      .filter((p) => p.width >= p.height && p.width > 1)
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 3);
  }, [products]);

  // Generate hero panorama client-side for the featured product
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

  // Selection handlers — clicking a card toggles it in the selection set
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const addSelectionToCart = useCallback(() => {
    const selectedProducts = products.filter((p) => selected.has(p.id));
    if (selectedProducts.length === 0) return;
    for (const p of selectedProducts) {
      add({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        unitPrice: p.price,
        width: p.width,
        height: p.height,
        totalMaps: p.width * p.height,
        previewSvg: p.previewSvg,
      });
    }
    toast({
      title: 'Added to cart',
      description: `${selectedProducts.length} ${selectedProducts.length === 1 ? 'piece' : 'pieces'} added to your cart.`,
    });
    clearSelection();
    navigate({ name: 'cart' });
  }, [products, selected, add, toast, clearSelection, navigate]);

  // Selection totals
  const selectedProducts = products.filter((p) => selected.has(p.id));
  const selectedTotal = selectedProducts.reduce((s, p) => s + p.price, 0);
  const selectedMaps = selectedProducts.reduce((s, p) => s + p.totalMaps, 0);

  const submitOrderLookup = () => {
    const code = orderLookup.trim().toUpperCase();
    if (!code) return;
    const normalized = code.startsWith('MAP-') ? code : `MAP-${code}`;
    navigate({ name: 'order', code: normalized });
  };

  return (
    <div>
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className="grid gap-8 px-[clamp(16px,5vw,64px)] pt-[clamp(32px,7vw,96px)] pb-[clamp(56px,9vw,128px)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:gap-[clamp(32px,6vw,96px)]">
        <div className="sydran-rise">
          <h1 className="font-wide-tight text-[clamp(40px,6.4vw,92px)] leading-[0.98]">
            Map art, delivered to your <em className="not-italic text-accent">/order</em>.
          </h1>
          <p className="mt-7 max-w-[46ch] text-[clamp(17px,1.5vw,20px)] leading-relaxed text-muted-foreground">
            Pick a piece, pay in-game, and the maps land in your in-game /order. Every map is built fresh from the original — what you see is what goes on your wall.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="sydran-btn"
            >
              Browse the catalog
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how"
              className="sydran-btn sydran-btn-ghost"
            >
              How it works
            </a>
          </div>
          <p className="mt-7 text-sm text-muted-foreground">
            <Package className="mr-1.5 inline h-3.5 w-3.5" />
            {loading ? 'Loading catalog…' : `${products.length} pieces in stock · singles from ${formatPrice(Math.min(...products.map((p) => p.price), 50000))}`}
          </p>
          <div className="mt-2.5 flex items-center gap-2 text-sm font-semibold">
            <span className="sydran-status-dot sydran-status-dot-online" />
            <span>Sydran Maps API · online</span>
          </div>

          {/* Quick order lookup */}
          <div className="mt-6 flex items-center gap-2">
            <Input
              value={orderLookup}
              onChange={(e) => setOrderLookup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitOrderLookup()}
              placeholder="Lookup order MAP-1042…"
              className="max-w-xs font-mono text-sm"
              aria-label="Quick order lookup"
              autoComplete="off"
            />
            <button
              className="sydran-btn sydran-btn-ghost px-4 py-2 text-sm"
              onClick={submitOrderLookup}
              disabled={orderLookup.trim().length < 3}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Open
            </button>
          </div>
        </div>

        {/* Showcase — featured map art */}
        <div className="grid grid-cols-2 gap-3.5">
          {showcase.length === 0 && !loading ? (
            <div className="col-span-2 grid aspect-[16/10] place-items-center bg-card">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            showcase.map((p, i) => (
              <figure
                key={p.id}
                className={cn(
                  'sydran-rise m-0',
                  i === 0 && 'col-span-2'
                )}
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}
              >
                <button
                  onClick={() => navigate({ name: 'product', id: p.code })}
                  className="block w-full text-left"
                >
                  <div className="border-[1.5px] border-primary bg-card p-[clamp(8px,1.2vw,14px)]">
                    <PixelArt
                      svg={p.previewSvg}
                      alt={p.name}
                      aspect={i === 0 ? 'wide' : 'square'}
                      className="w-full"
                    />
                  </div>
                  <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{sizeLabel(p.width, p.height)} piece</span>
                    <span className="font-medium text-foreground">{formatPrice(p.price)}</span>
                  </figcaption>
                </button>
              </figure>
            ))
          )}
        </div>
      </section>

      {/* ─── HOW IT WORKS (dark section) ─────────────────────────────── */}
      <section id="how" className="sydran-dark-section px-[clamp(16px,5vw,64px)] py-[clamp(56px,9vw,120px)]">
        <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-[clamp(32px,6vw,96px)]">
          <div>
            <h2 className="font-wide text-[clamp(30px,3.8vw,52px)] leading-[1.02]">
              Four steps, all in-game.
            </h2>
            <p className="mt-4.5 max-w-[36ch] leading-relaxed text-[oklch(0.8_0.025_80)]">
              No Discord middleman, no automated bots. Payment is matched automatically through the in-game chat API, and the delivery member drops the maps directly into your in-game /order.
            </p>
          </div>
          <ol className="m-0 list-none p-0">
            {HOW_STEPS.map((step, i) => (
              <li
                key={i}
                className="grid grid-cols-[64px_1fr] gap-x-5 gap-y-1 border-t border-[oklch(0.4_0.025_62)] py-6 last:border-b last:border-[oklch(0.4_0.025_62)]"
              >
                <span className="sydran-step-num row-span-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="m-0 text-[19px] font-bold">{step.title}</h3>
                <p className="m-0 max-w-[58ch] leading-relaxed text-[oklch(0.8_0.025_80)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── CATALOG ─────────────────────────────────────────────────── */}
      <section id="catalog" className="px-[clamp(16px,5vw,64px)] pt-[clamp(56px,8vw,112px)] pb-32">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="font-wide text-[clamp(30px,3.8vw,52px)] leading-[1.02]">
              Catalog
            </h2>
            <p className="mt-2.5 max-w-[52ch] text-muted-foreground">
              Click a card to add it to your order. Click the magnifier to see the full piece and its tile breakdown.
            </p>
          </div>
          {/* Filter pills — sharp corners, ink border, pressed state */}
          <div className="inline-flex overflow-hidden rounded-[3px] border-[1.5px] border-primary">
            {(['all', 'single', 'multi'] as const).map((f, i) => (
              <button
                key={f}
                onClick={() => setSize(f === 'single' ? '1x1' : f === 'multi' ? 'multi' : 'all')}
                className={cn(
                  'border-0 bg-transparent px-4 py-2 text-sm font-medium text-primary transition-colors',
                  'hover:bg-primary/10',
                  (size === 'all' && f === 'all') ||
                  (size === '1x1' && f === 'single') ||
                  (size !== 'all' && size !== '1x1' && f === 'multi')
                    ? 'bg-primary text-primary-foreground hover:bg-primary'
                    : '',
                  i > 0 && 'border-l-[1.5px] border-primary'
                )}
                aria-pressed={
                  (size === 'all' && f === 'all') ||
                  (size === '1x1' && f === 'single') ||
                  (size !== 'all' && size !== '1x1' && f === 'multi')
                }
              >
                {f === 'all' ? 'All' : f === 'single' ? 'Single maps' : 'Multi-map'}
              </button>
            ))}
          </div>
        </div>

        {/* Search + category + sort */}
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center">
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
        </div>

        {/* Gallery grid */}
        {loading ? (
          <div className="sydran-gallery-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-none" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="border-[1.5px] border-dashed border-border bg-card/40 p-12 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No map-art matches your filters.
            </p>
          </div>
        ) : (
          <div className="sydran-gallery-grid">
            {products.map((p, i) => (
              <div
                key={p.id}
                className="sydran-rise"
                style={{ animationDelay: `${Math.min(i, 30) * 15}ms` }}
              >
                <MapCard
                  product={p}
                  selected={selected.has(p.id)}
                  onSelect={() => toggleSelect(p.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── SELECTION TRAY (slide-up bottom bar) ────────────────────── */}
      <div
        className={cn(
          'sydran-tray',
          selected.size > 0 && 'sydran-tray-open'
        )}
        aria-live="polite"
      >
        <span className="font-variant-numeric: tabular-nums whitespace-nowrap">
          <strong className="font-bold">
            {selected.size} {selected.size === 1 ? 'piece' : 'pieces'}
          </strong>
          {' · '}
          <span className="font-medium">{formatPrice(selectedTotal)}</span>
          <small className="mt-0.5 block text-xs opacity-75">
            {selectedMaps} {selectedMaps === 1 ? 'map' : 'maps'} to deliver
          </small>
        </span>
        <button
          className="sydran-btn sydran-btn-ghost border-[oklch(0.6_0.02_70)] !bg-transparent !text-primary-foreground px-3.5 py-2.5 text-sm hover:!border-primary-foreground"
          onClick={clearSelection}
        >
          Reset
        </button>
        <button
          className="sydran-btn sydran-btn-accent px-4 py-2.5 text-sm"
          onClick={addSelectionToCart}
          disabled={selected.size === 0}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Complete order
        </button>
      </div>
    </div>
  );
}
