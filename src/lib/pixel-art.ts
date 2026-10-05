/**
 * Procedural pixel-art preview generator.
 * Each product gets a stable, deterministic SVG preview that visually
 * conveys its dimensions and category — no external image files needed.
 *
 * The pixel grid mimics the look of a Minecraft map (128x128 pixels per tile)
 * but rendered at lower resolution for the web preview.
 */

const PALETTES: Record<string, string[]> = {
  anime: ['#f9a8d4', '#ec4899', '#8b5cf6', '#fbbf24', '#fde68a', '#1f2937'],
  castle: ['#9ca3af', '#6b7280', '#374151', '#d1d5db', '#fbbf24', '#7c2d12'],
  nature: ['#84cc16', '#22c55e', '#15803d', '#854d0e', '#a3e635', '#facc15'],
  abstract: ['#06b6d4', '#0ea5e9', '#8b5cf6', '#f97316', '#facc15', '#1f2937'],
  logo: ['#eab308', '#facc15', '#1f2937', '#f8fafc', '#fde68a', '#0f172a'],
  portrait: ['#fde68a', '#fbbf24', '#b45309', '#1f2937', '#f9a8d4', '#8b5cf6'],
  default: ['#6b7280', '#9ca3af', '#d1d5db', '#fbbf24', '#22c55e', '#ec4899'],
};

// Mulberry32 deterministic PRNG — same seed always produces same art.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteFor(category: string): string[] {
  return PALETTES[category.toLowerCase()] ?? PALETTES.default;
}

/**
 * Generate an SVG preview string for a product.
 * Renders one blocky pixel grid covering the entire product (regardless
 * of how many Minecraft tiles it contains). Optional grid overlay shows
 * tile boundaries for large maps.
 */
export function generatePreviewSvg(opts: {
  name: string;
  category: string;
  width: number;
  height: number;
  seed?: number;
  showTileGrid?: boolean;
}): string {
  const { name, category, width, height } = opts;
  const seed = opts.seed ?? hashString(name + category);
  const rand = rng(seed);
  const palette = paletteFor(category);

  // Each tile is 32 visual cells wide. Total visual cells = width*32 × height*32.
  // We render at lower resolution: choose ~16 cells per tile for preview clarity.
  const cellsPerTile = 16;
  const totalCols = Math.max(width, 1) * cellsPerTile;
  const totalRows = Math.max(height, 1) * cellsPerTile;

  // Build pixel grid by sampling a low-frequency noise so adjacent cells correlate.
  // Result looks like real map-art (regions of color rather than pure noise).
  const cells: string[] = [];
  const cellSize = 8; // px in svg
  const svgW = totalCols * cellSize;
  const svgH = totalRows * cellSize;

  for (let y = 0; y < totalRows; y++) {
    for (let x = 0; x < totalCols; x++) {
      // Coarse noise via hashed buckets — gives chunky regions.
      const bx = Math.floor(x / 3);
      const by = Math.floor(y / 3);
      const bucket = (hashString(`${bx},${by},${seed}`) >>> 0) / 4294967296;
      const noise = (rand() + bucket) / 2;
      const idx = Math.floor(noise * palette.length) % palette.length;
      const color = palette[idx];
      cells.push(
        `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
      );
    }
  }

  // Optional: tile-grid overlay — thin lines marking every tile boundary.
  const gridLines: string[] = [];
  if (opts.showTileGrid && (width > 1 || height > 1)) {
    const stroke = 'rgba(0,0,0,0.18)';
    for (let i = 1; i < width; i++) {
      const x = i * cellsPerTile * cellSize;
      gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${svgH}" stroke="${stroke}" stroke-width="2"/>`);
    }
    for (let j = 1; j < height; j++) {
      const y = j * cellsPerTile * cellSize;
      gridLines.push(`<line x1="0" y1="${y}" x2="${svgW}" y2="${y}" stroke="${stroke}" stroke-width="2"/>`);
    }
  }

  // Soft vignette for depth.
  const vignette = `<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="url(#vignette)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
    </radialGradient>
  </defs>
  ${cells.join('\n  ')}
  ${gridLines.join('\n  ')}
  ${vignette}
</svg>`;
}

/**
 * Generate a per-tile hash string. Used to populate MapTile.tileHash.
 * In a real Fabric mod this would be SHA-256 of the actual color byte array;
 * here we deterministically simulate it from the position + product name.
 */
export function generateTileHash(opts: {
  productName: string;
  category: string;
  posX: number;
  posY: number;
}): string {
  const { productName, category, posX, posY } = opts;
  // Build a 64-char hex string by repeatedly hashing.
  const base = `${productName}::${category}::${posX}::${posY}`;
  let hex = '';
  let state = hashString(base);
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state ^ (state >>> 13), 0x85ebca6b) + 0x9e3779b9) >>> 0;
    hex += state.toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Generate the master product fingerprint — SHA-256-style hash of the entire
 * product (combines all tile hashes). This is what /sydran add checks against
 * the Product.mapHash unique column to detect duplicates server-side.
 */
export function generateProductHash(opts: {
  productName: string;
  category: string;
  width: number;
  height: number;
}): string {
  const { productName, category, width, height } = opts;
  let combined = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      combined += generateTileHash({ productName, category, posX: x, posY: y });
    }
  }
  // Compress the long combined string into a 64-char hash.
  let state = hashString(productName + '::' + category + '::' + width + 'x' + height);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state ^ (combined.charCodeAt(i * 16) || 0), 0x9e3779b1) + 0x85ebca77) >>> 0;
    hex += state.toString(16).padStart(8, '0');
  }
  return hex;
}

/** Compact tile color data string. In a real mod this would be the 128x128 byte array. */
export function generateTileData(opts: {
  productName: string;
  posX: number;
  posY: number;
}): string {
  // Just return a deterministic token. Real implementation would store actual pixel bytes.
  return `${opts.productName}::${opts.posX}x${opts.posY}`;
}

/**
 * Generate a per-tile SVG preview for a single tile inside a larger product.
 * Each tile gets a self-contained 16x16 cell grid derived from the
 * (productName, category, posX, posY) tuple, so:
 *
 *   - The same tile always renders the same pixels (deterministic).
 *   - Different tiles within the same product render DIFFERENT pixels
 *     (so the breakdown grid actually looks like distinct map tiles, not
 *     the same image repeated).
 *
 * Phase 15 spec: "The product should also be able to show individual tiles
 * if needed." — this is what powers that view.
 */
export function generateTilePreviewSvg(opts: {
  productName: string;
  category: string;
  posX: number;
  posY: number;
}): string {
  const { productName, category, posX, posY } = opts;
  // Use the tile hash itself as the seed — guarantees per-tile uniqueness.
  const tileHashStr = generateTileHash({ productName, category, posX, posY });
  const seed = parseInt(tileHashStr.slice(0, 8), 16);
  const rand = rng(seed);
  const palette = paletteFor(category);

  const cellsPerSide = 16; // 16x16 visual cells per tile
  const cellSize = 8;
  const svgW = cellsPerSide * cellSize;
  const svgH = cellsPerSide * cellSize;

  const cells: string[] = [];
  for (let y = 0; y < cellsPerSide; y++) {
    for (let x = 0; x < cellsPerSide; x++) {
      // Coarse noise — chunky regions like real map art.
      const bx = Math.floor(x / 3);
      const by = Math.floor(y / 3);
      const bucket = (hashString(`${bx},${by},${tileHashStr.slice(0, 4)}`) >>> 0) / 4294967296;
      const noise = (rand() + bucket) / 2;
      const idx = Math.floor(noise * palette.length) % palette.length;
      const color = palette[idx];
      cells.push(
        `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  ${cells.join('\n  ')}
</svg>`;
}

