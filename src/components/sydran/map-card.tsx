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
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * Outline-based editorial map card.
 *
 *   ┌──────────────────┐
 *   │ [🔍]        [✓]  │   ← zoom button (hover, top-left), check (selected, top-right)
 *   │                  │
 *   │     MAP ART      │   ← the pixel-art preview fills the card
 *   │                  │
 *   │ [NEW]            │   ← NEW badge (only if product is fresh)
 *   │                  │
 *   │ $1.5M            │   ← price tag (bottom-left, paper chip)
 *   └──────────────────┘
 *
 * The card uses a thin transparent outline that becomes ink on hover,
 * and a 3px solid accent outline when selected. No heavy bevels.
 */
export function MapCard({ product, className, selected = false, onSelect }: MapCardProps) {
  const { navigate } = useRouter();
  const maps = totalMaps(product.width, product.height);
  const isLarge = product.width > 1 || product.height > 1;
  const isNew = false; // could be wired to product.createdAt < 24h

  const handleClick = () => {
    if (onSelect) {
      onSelect();
    } else {
      navigate({ name: 'product', id: product.code });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-pressed={selected}
      aria-label={`${isLarge ? `${sizeLabel(product.width, product.height)} piece, ${maps} maps` : 'Single map'}, ${formatPrice(product.price)}`}
      className={cn(
        'sydran-card group relative aspect-square overflow-hidden',
        selected && 'sydran-card-selected',
        className
      )}
    >
      <PixelArt
        svg={product.previewSvg}
        alt={`${product.name} preview`}
        aspect="square"
        className="h-full w-full"
      />

      {/* Zoom button — top-left, appears on hover */}
      <button
        className="sydran-zoom"
        aria-label="Zoom in"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          navigate({ name: 'product', id: product.code });
        }}
      >
        <Search className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      {/* NEW badge — top-right (only on fresh products) */}
      {isNew && (
        <span className="sydran-new-badge absolute right-1.5 top-1.5">
          NEW
        </span>
      )}

      {/* Check circle — top-right (when selected) */}
      <span className="sydran-check" aria-hidden={!selected}>
        <Check className="h-3 w-3" strokeWidth={3.5} />
      </span>

      {/* Price tag — bottom-left, paper chip */}
      <span className="sydran-price-tag absolute bottom-1.5 left-1.5">
        {formatPrice(product.price)}
      </span>

      {/* Large-map dimension badge — bottom-right, only on multi-tile */}
      {isLarge && (
        <span className="sydran-price-tag absolute bottom-1.5 right-1.5 inline-flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {sizeLabel(product.width, product.height)}
        </span>
      )}

      {/* Name label — top-left under zoom, fades in on hover */}
      <div className="pointer-events-none absolute inset-x-1.5 top-9 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="inline-block max-w-full truncate bg-background/90 px-1.5 py-0.5 text-xs font-semibold text-foreground">
          {product.name}
        </span>
      </div>
    </div>
  );
}
