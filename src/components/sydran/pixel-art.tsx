'use client';

import { cn } from '@/lib/utils';

interface PixelArtProps {
  svg: string;
  alt: string;
  className?: string;
  // Optional aspect ratio override. Defaults to the SVG's intrinsic ratio.
  aspect?: 'square' | 'video' | 'wide' | 'tile' | 'auto';
  // Tile-grid preview shows individual tiles — used in product detail
  // for large maps so users can verify tile positions.
  pixelated?: boolean;
}

/**
 * Renders a procedural pixel-art SVG preview safely.
 * Uses dangerouslySetInnerHTML because the SVG string is generated
 * server-side by /lib/pixel-art and trusted.
 */
export function PixelArt({
  svg,
  alt,
  className,
  aspect = 'square',
  pixelated = true,
}: PixelArtProps) {
  const aspectClass =
    aspect === 'square'
      ? 'aspect-square'
      : aspect === 'video'
        ? 'aspect-video'
        : aspect === 'wide'
          ? 'aspect-[16/9]'
          : aspect === 'tile'
            ? 'aspect-square'
            : '';
  return (
    <div
      className={cn('relative overflow-hidden bg-muted/40', aspectClass, className)}
      role="img"
      aria-label={alt}
    >
      <div
        className={cn('absolute inset-0 h-full w-full', pixelated && 'pixelated')}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
