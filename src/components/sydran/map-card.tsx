'use client';

import { cn } from '@/lib/utils';
import { formatPrice, sizeLabel, totalMaps } from '@/lib/sydran';
import type { ProductView } from '@/lib/sydran';
import { PixelArt } from './pixel-art';
import { useRouter } from './router';
import { Layers, Search } from 'lucide-react';

interface MapCardProps {
  product: ProductView;
  className?: string;
}

/**
 * Minecraft inventory-slot map card.
 *
 *   ┌──────────────────┐
 *   │ [1.5M]      [✓]  │   ← gold coin price (top-left), active check (top-right)
 *   │                  │
 *   │   ┌──────────┐   │
 *   │   │  MAP ART │   │   ← the pixel-art preview, glowing on hover
 *   │   └──────────┘   │
 *   │                  │
 *   │ Anime Castle     │   ← name (parchment text)
 *   │ 10×6 · 60 maps   │   ← size label
 *   └──────────────────┘
 *
 * The card uses slot-border (a 4-layer box-shadow stack) to mimic the
 * recessed dark border of a Minecraft inventory slot. On hover, the slot
 * gets a raised emerald ring and the preview glows.
 */
export function MapCard({ product, className }: MapCardProps) {
  const { navigate } = useRouter();
  const maps = totalMaps(product.width, product.height);
  const isLarge = product.width > 1 || product.height > 1;

  return (
    <button
      onClick={() => navigate({ name: 'product', id: product.code })}
      className={cn(
        'group relative flex flex-col overflow-hidden bg-card text-left sydran-card-hover',
        'slot-border hover:slot-border-raised',
        'focus-visible:outline-none focus-visible:slot-border-raised',
        className
      )}
      aria-label={`View ${product.name} (${sizeLabel(product.width, product.height)}, ${formatPrice(product.price)})`}
    >
      {/* Preview area — square slot containing the pixel art */}
      <div className="relative aspect-square overflow-hidden bg-background">
        {/* Inner dark inset (the actual "slot" the item sits in) */}
        <div className="absolute inset-1 bg-background/80">
          <PixelArt
            svg={product.previewSvg}
            alt={`${product.name} preview`}
            aspect="square"
            className="item-glow absolute inset-0 transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        {/* Coin-style price tag — top-left */}
        <div className="absolute left-2 top-2 z-10">
          <span className="coin-tag inline-flex items-center rounded-sm px-2 py-0.5 font-pixel text-xs font-bold">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Active checkmark — top-right (only when product is active) */}
        {product.status === 'active' && (
          <div className="absolute right-2 top-2 z-10">
            <span
              className="inline-flex h-5 w-5 items-center justify-center bg-emerald-500 text-emerald-950 slot-border"
              title="Active"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
                <path d="M3 8 L7 12 L13 4 L11 4 L7 9 L5 7 Z" />
              </svg>
            </span>
          </div>
        )}

        {/* Hover magnifier — bottom-right */}
        <div className="absolute bottom-2 right-2 z-10 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="inline-flex h-7 w-7 items-center justify-center bg-background/90 text-foreground slot-border">
            <Search className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Large-map dimension badge — bottom-left, only on multi-tile products */}
        {isLarge && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="inline-flex items-center gap-1 bg-background/85 px-1.5 py-0.5 font-pixel text-[10px] font-semibold text-violet-200 slot-border">
              <Layers className="h-3 w-3" />
              {sizeLabel(product.width, product.height)} · {maps}
            </span>
          </div>
        )}
      </div>

      {/* Footer — name + dimension label */}
      <div className="flex flex-col gap-0.5 border-t-2 border-background/80 bg-card px-2 py-2">
        <div className="truncate font-pixel text-xs font-bold text-foreground">
          {product.name}
        </div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="capitalize">{product.category}</span>
          <span className="font-mono">{sizeLabel(product.width, product.height)}</span>
        </div>
      </div>
    </button>
  );
}
