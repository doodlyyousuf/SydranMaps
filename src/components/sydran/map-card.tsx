'use client';

import { cn } from '@/lib/utils';
import { formatPrice, sizeLabel, totalMaps } from '@/lib/sydran';
import type { ProductView } from '@/lib/sydran';
import { PixelArt } from './pixel-art';
import { useRouter } from './router';
import { Check, Search, Layers } from 'lucide-react';

interface MapCardProps {
  product: ProductView;
  className?: string;
}

/**
 * Map card per Phase 17 of the redesign:
 *
 *   ┌──────────────────┐
 *   │ $1.5M       ✓    │   ← price top-left, "active" check top-right
 *   │                  │
 *   │     MAP ART      │   ← preview fills the middle
 *   │                  │
 *   │             🔍   │   ← hover magnifier bottom-right
 *   │                  │
 *   │ Anime Castle     │   ← name bottom
 *   └──────────────────┘
 *
 * The price stays top-left so it doesn't cover the map name.
 * On large maps the size + tile count appears as a sub-label.
 */
export function MapCard({ product, className }: MapCardProps) {
  const { navigate } = useRouter();
  const maps = totalMaps(product.width, product.height);
  const isLarge = product.width > 1 || product.height > 1;

  return (
    <button
      onClick={() => navigate({ name: 'product', id: product.code })}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left sydran-card-hover hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      aria-label={`View ${product.name} (${sizeLabel(product.width, product.height)}, ${formatPrice(product.price)})`}
    >
      {/* Preview area — square to keep the grid tidy */}
      <div className="relative aspect-square overflow-hidden">
        <PixelArt
          svg={product.previewSvg}
          alt={`${product.name} preview`}
          aspect="square"
          className="transition-transform duration-300 group-hover:scale-105"
        />

        {/* Price chip — top-left, does not overlap the name */}
        <div className="absolute left-1.5 top-1.5">
          <span
            className="inline-flex items-center rounded-md bg-background/90 px-2 py-0.5 text-xs font-bold text-accent shadow ring-1 ring-border/50 backdrop-blur"
            style={{ color: product.accentColor }}
          >
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Active check — top-right */}
        {product.status === 'active' && (
          <div className="absolute right-1.5 top-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-emerald-950 shadow ring-1 ring-emerald-300/40">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          </div>
        )}

        {/* Hover magnifier — bottom-right */}
        <div className="absolute bottom-1.5 right-1.5 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border/50 backdrop-blur">
            <Search className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Large-map size badge — bottom-left, only on multi-tile products */}
        {isLarge && (
          <div className="absolute bottom-1.5 left-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground ring-1 ring-border/50 backdrop-blur">
              <Layers className="h-3 w-3" />
              {sizeLabel(product.width, product.height)} · {maps} maps
            </span>
          </div>
        )}
      </div>

      {/* Name footer — bottom of the card */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-card-foreground">
            {product.name}
          </div>
          <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {product.category}
          </div>
        </div>
      </div>
    </button>
  );
}
