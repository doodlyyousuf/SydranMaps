/**
 * Procedural pixel-art preview generator for Sydran Maps.
 *
 * Each category has a RECOGNIZABLE silhouette/motif (anime face, castle
 * battlements, tree, sunset, creeper face, abstract gradient), so the
 * preview actually looks like map-art instead of random colored noise.
 *
 * Tile hashes are still deterministic per (productName, category, posX, posY)
 * so the duplicate-detection logic in the API still works identically.
 *
 * The output is a self-contained SVG string rendered inside PixelArt.
 */

// ─── Palette per category ────────────────────────────────────────────
const PALETTES: Record<string, { bg: string; mid: string; fg: string; accent: string }> = {
  anime:    { bg: '#2a1530', mid: '#7c2d6f', fg: '#f9a8d4', accent: '#fbbf24' },
  castle:   { bg: '#1c1f2e', mid: '#3f4862', fg: '#9ca3af', accent: '#fbbf24' },
  nature:   { bg: '#0e1f12', mid: '#1f4d2a', fg: '#84cc16', accent: '#facc15' },
  abstract: { bg: '#0e1626', mid: '#0e7490', fg: '#67e8f9', accent: '#f97316' },
  logo:     { bg: '#0a1a0a', mid: '#1f6f2a', fg: '#3ee05a', accent: '#0a0a0a' },
  portrait: { bg: '#1a0e2a', mid: '#6b21a8', fg: '#fde68a', accent: '#ec4899' },
  default:  { bg: '#1c1f2e', mid: '#3f4862', fg: '#9ca3af', accent: '#fbbf24' },
};

export function paletteFor(category: string) {
  return PALETTES[category.toLowerCase()] ?? PALETTES.default;
}

// ─── Deterministic PRNG (Mulberry32) ─────────────────────────────────
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

// ══════════════════════════════════════════════════════════════════════
// PER-CATEGORY MOTIF DRAWERS
//
// Each drawer paints into a `cells` array of <rect> SVG strings on a
// fixed-size grid. The grid is `cols × rows` cells of size `cell` px.
// All drawers are deterministic given the same (productName, seed).
// ══════════════════════════════════════════════════════════════════════

type DrawContext = {
  cells: string[];
  cols: number;
  rows: number;
  cell: number;
  rand: () => number;
  palette: { bg: string; mid: string; fg: string; accent: string };
};

function fillBg(ctx: DrawContext) {
  const { cells, cols, rows, cell, palette } = ctx;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Slight noise in background — 1 in 8 cells gets a darker shade.
      const noise = ctx.rand() < 0.12;
      const color = noise ? palette.bg : palette.bg;
      cells.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
      );
    }
  }
}

function fillRect(
  ctx: DrawContext,
  x0: number, y0: number, w: number, h: number, color: string
) {
  const { cells, cell } = ctx;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= ctx.cols || y >= ctx.rows) continue;
      cells.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
      );
    }
  }
}

/** Pixel-perfect ellipse using a midpoint algorithm. */
function fillEllipse(
  ctx: DrawContext,
  cx: number, cy: number, rx: number, ry: number, color: string
) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        fillRect(ctx, cx + x, cy + y, 1, 1, color);
      }
    }
  }
}

// ─── ANIME FACE ──────────────────────────────────────────────────────
// Big sparkly eyes, small nose, hair silhouette on top.
function drawAnime(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  fillBg(ctx);

  // Hair silhouette (top third of canvas) — sweeping arcs.
  fillRect(ctx, 0, 0, cols, Math.floor(rows / 3), palette.mid);
  // Bangs — irregular triangular fringe
  for (let x = 0; x < cols; x++) {
    const fringeH = Math.floor(2 + (ctx.rand() * 3));
    fillRect(ctx, x, Math.floor(rows / 3), 1, fringeH, palette.mid);
  }
  // Side hair strands down the sides
  fillRect(ctx, 0, Math.floor(rows / 3), 2, Math.floor(rows / 2), palette.mid);
  fillRect(ctx, cols - 2, Math.floor(rows / 3), 2, Math.floor(rows / 2), palette.mid);

  // Skin / face plate (center oval)
  const faceTop = Math.floor(rows * 0.32);
  const faceBot = Math.floor(rows * 0.78);
  const faceL = Math.floor(cols * 0.22);
  const faceR = cols - faceL;
  fillEllipse(ctx, Math.floor(cols / 2), Math.floor((faceTop + faceBot) / 2),
              Math.floor((faceR - faceL) / 2), Math.floor((faceBot - faceTop) / 2),
              palette.fg);

  // Two big sparkly eyes
  const eyeY = Math.floor(rows * 0.52);
  const eyeXL = Math.floor(cols * 0.36);
  const eyeXR = Math.floor(cols * 0.64);
  // eye whites (small)
  fillRect(ctx, eyeXL - 1, eyeY - 1, 3, 3, '#ffffff');
  fillRect(ctx, eyeXR - 1, eyeY - 1, 3, 3, '#ffffff');
  // iris (palette accent — usually gold)
  fillRect(ctx, eyeXL, eyeY, 1, 1, palette.accent);
  fillRect(ctx, eyeXR, eyeY, 1, 1, palette.accent);
  // pupil
  fillRect(ctx, eyeXL, eyeY + 1, 1, 1, '#0a0a0a');
  fillRect(ctx, eyeXR, eyeY + 1, 1, 1, '#0a0a0a');

  // Tiny mouth (pink)
  const mouthY = Math.floor(rows * 0.7);
  fillRect(ctx, Math.floor(cols / 2) - 1, mouthY, 3, 1, '#f9a8d4');

  // Accent stars in the hair (sparkles)
  if (ctx.rand() > 0.4) {
    fillRect(ctx, Math.floor(cols * 0.7), Math.floor(rows * 0.1), 1, 1, palette.accent);
    fillRect(ctx, Math.floor(cols * 0.25), Math.floor(rows * 0.18), 1, 1, palette.accent);
  }
}

// ─── CASTLE BATTLEMENTS ──────────────────────────────────────────────
function drawCastle(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  fillBg(ctx);

  // Sky gradient — top has stars
  for (let i = 0; i < 6; i++) {
    const sx = Math.floor(ctx.rand() * cols);
    const sy = Math.floor(ctx.rand() * rows * 0.3);
    fillRect(ctx, sx, sy, 1, 1, palette.accent);
  }

  // Ground
  const groundY = Math.floor(rows * 0.78);
  fillRect(ctx, 0, groundY, cols, rows - groundY, palette.mid);

  // Castle wall (large rectangle)
  const wallTop = Math.floor(rows * 0.42);
  const wallH = groundY - wallTop;
  fillRect(ctx, Math.floor(cols * 0.1), wallTop, Math.floor(cols * 0.8), wallH, palette.fg);

  // Wall texture (windows + cracks)
  for (let i = 0; i < 4; i++) {
    const wx = Math.floor(cols * (0.2 + i * 0.18));
    const wy = wallTop + Math.floor(wallH * 0.3);
    fillRect(ctx, wx, wy, 2, 3, palette.bg);
  }

  // Battlements (crenellations) — alternating blocks on top of wall
  const battlementY = wallTop - 2;
  const battlementW = 3;
  for (let x = Math.floor(cols * 0.1); x < cols * 0.9; x += battlementW * 2) {
    fillRect(ctx, x, battlementY, battlementW, 2, palette.fg);
  }

  // Two side towers
  const towerW = Math.max(3, Math.floor(cols * 0.12));
  const towerH = Math.floor(rows * 0.5);
  const towerTop = Math.floor(rows * 0.25);
  fillRect(ctx, 0, towerTop, towerW, towerH, palette.mid);
  fillRect(ctx, cols - towerW, towerTop, towerW, towerH, palette.mid);
  // Tower roofs (triangular)
  for (let i = 0; i < towerW; i++) {
    const h = towerW - i;
    fillRect(ctx, i, towerTop - h, 1, h, palette.accent);
    fillRect(ctx, cols - towerW + i, towerTop - h, 1, h, palette.accent);
  }

  // Central gate
  const gateW = Math.max(3, Math.floor(cols * 0.15));
  const gateH = Math.floor(wallH * 0.55);
  fillRect(ctx, Math.floor((cols - gateW) / 2), groundY - gateH, gateW, gateH, palette.bg);
  // Gate arch (top arc)
  fillRect(ctx, Math.floor((cols - gateW) / 2) + 1, groundY - gateH - 1, gateW - 2, 1, palette.bg);

  // Flag on top of central tower (between the two side towers)
  const flagX = Math.floor(cols / 2);
  const flagY = wallTop - 5;
  fillRect(ctx, flagX, flagY, 1, 5, palette.fg);
  fillRect(ctx, flagX + 1, flagY, 3, 2, palette.accent);
}

// ─── TREE / NATURE ──────────────────────────────────────────────────
function drawNature(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  fillBg(ctx);

  // Sky gradient dots (sun flecks)
  for (let i = 0; i < 8; i++) {
    fillRect(ctx, Math.floor(ctx.rand() * cols), Math.floor(ctx.rand() * rows * 0.4),
             1, 1, palette.accent);
  }

  // Grass ground
  const groundY = Math.floor(rows * 0.7);
  fillRect(ctx, 0, groundY, cols, rows - groundY, palette.mid);
  // Grass blades (random up-spikes on the ground line)
  for (let x = 0; x < cols; x += 2) {
    if (ctx.rand() > 0.6) {
      fillRect(ctx, x, groundY - 1, 1, 1, palette.fg);
    }
  }

  // Trunk
  const trunkX = Math.floor(cols / 2) - 1;
  const trunkY = groundY - Math.floor(rows * 0.35);
  const trunkH = groundY - trunkY;
  fillRect(ctx, trunkX, trunkY, 2, trunkH, '#5b3a1a');
  // Bark texture
  fillRect(ctx, trunkX, trunkY + 2, 1, 1, '#3a2410');
  fillRect(ctx, trunkX + 1, trunkY + 5, 1, 1, '#3a2410');

  // Foliage — three overlapping circles
  const folY = Math.floor(rows * 0.32);
  fillEllipse(ctx, Math.floor(cols / 2), folY, Math.floor(cols * 0.32), Math.floor(rows * 0.22), palette.fg);
  fillEllipse(ctx, Math.floor(cols * 0.38), folY + 3, Math.floor(cols * 0.2), Math.floor(rows * 0.15), palette.fg);
  fillEllipse(ctx, Math.floor(cols * 0.62), folY + 3, Math.floor(cols * 0.2), Math.floor(rows * 0.15), palette.fg);

  // Highlight on top of foliage
  fillEllipse(ctx, Math.floor(cols / 2), folY - 2, Math.floor(cols * 0.15), Math.floor(rows * 0.08), '#a3e635');
  // Shadow on bottom of foliage
  fillEllipse(ctx, Math.floor(cols / 2), folY + 4, Math.floor(cols * 0.25), Math.floor(rows * 0.06), palette.mid);

  // Falling leaf accents
  for (let i = 0; i < 3; i++) {
    fillRect(ctx, Math.floor(ctx.rand() * cols), Math.floor(rows * 0.45 + ctx.rand() * rows * 0.2),
             1, 1, palette.accent);
  }
}

// ─── SUNSET GRADIENT (abstract) ──────────────────────────────────────
function drawAbstract(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  // Horizontal gradient bands (no bg fill needed)
  const bandH = Math.ceil(rows / 8);
  const colors = [palette.bg, palette.mid, palette.fg, palette.accent];
  for (let i = 0; i < 8; i++) {
    const y = i * bandH;
    const c = colors[Math.min(i, colors.length - 1)];
    fillRect(ctx, 0, y, cols, bandH, c);
  }

  // Sun disc
  const sunY = Math.floor(rows * 0.4);
  fillEllipse(ctx, Math.floor(cols / 2), sunY, Math.floor(cols * 0.18), Math.floor(rows * 0.18), palette.accent);

  // Reflection lines on the bottom half
  for (let i = 0; i < 5; i++) {
    const y = Math.floor(rows * (0.55 + i * 0.08));
    fillRect(ctx, Math.floor(cols * 0.25), y, Math.floor(cols * 0.5), 1, palette.fg);
  }

  // Mountain silhouettes (foreground)
  const mtnY = Math.floor(rows * 0.65);
  // Left peak
  for (let i = 0; i < cols / 2; i++) {
    const h = Math.floor((cols / 2 - Math.abs(i - cols / 4)) * 0.4);
    fillRect(ctx, i, mtnY - h, 1, h + (rows - mtnY), palette.bg);
  }
  // Right peak
  for (let i = Math.floor(cols / 2); i < cols; i++) {
    const h = Math.floor((cols / 2 - Math.abs(i - (cols * 3) / 4)) * 0.5);
    fillRect(ctx, i, mtnY - h, 1, h + (rows - mtnY), palette.bg);
  }
}

// ─── CREEPER FACE (logo) ─────────────────────────────────────────────
function drawLogo(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  // Solid creeper-green base
  fillRect(ctx, 0, 0, cols, rows, palette.mid);
  // Texture noise
  for (let i = 0; i < cols * rows * 0.15; i++) {
    fillRect(ctx, Math.floor(ctx.rand() * cols), Math.floor(ctx.rand() * rows),
             1, 1, palette.bg);
  }
  for (let i = 0; i < cols * rows * 0.1; i++) {
    fillRect(ctx, Math.floor(ctx.rand() * cols), Math.floor(ctx.rand() * rows),
             1, 1, palette.fg);
  }

  // Creeper face is two square eyes + a central vertical nose + a square mouth.
  const cx = Math.floor(cols / 2);
  const eyeY = Math.floor(rows * 0.28);
  const eyeW = Math.max(2, Math.floor(cols * 0.14));
  const eyeH = Math.max(3, Math.floor(rows * 0.18));
  // Left eye
  fillRect(ctx, cx - Math.floor(cols * 0.22) - eyeW, eyeY, eyeW, eyeH, palette.accent);
  // Right eye
  fillRect(ctx, cx + Math.floor(cols * 0.22), eyeY, eyeW, eyeH, palette.accent);

  // Nose (vertical rectangle, centered)
  fillRect(ctx, cx - 1, eyeY + eyeH, 2, Math.floor(rows * 0.18), palette.accent);

  // Mouth — wide rectangle at the bottom, with two up-ticks at the corners
  const mouthY = eyeY + eyeH + Math.floor(rows * 0.18);
  const mouthW = Math.max(4, Math.floor(cols * 0.4));
  fillRect(ctx, cx - Math.floor(mouthW / 2), mouthY, mouthW, Math.floor(rows * 0.22), palette.accent);
  // Up-ticks
  fillRect(ctx, cx - Math.floor(mouthW / 2), mouthY - 2, 2, 2, palette.accent);
  fillRect(ctx, cx + Math.floor(mouthW / 2) - 2, mouthY - 2, 2, 2, palette.accent);
}

// ─── PORTRAIT (crowned figure) ───────────────────────────────────────
function drawPortrait(ctx: DrawContext) {
  const { palette, cols, rows } = ctx;
  fillBg(ctx);

  // Background gradient (royal purple wash)
  for (let y = 0; y < rows; y++) {
    const c = y < rows / 2 ? palette.bg : palette.mid;
    fillRect(ctx, 0, y, cols, 1, c);
  }

  // Shoulders/torso
  const bodyTop = Math.floor(rows * 0.7);
  fillEllipse(ctx, Math.floor(cols / 2), bodyTop + Math.floor((rows - bodyTop) / 2),
              Math.floor(cols * 0.45), Math.floor(rows * 0.3), palette.fg);
  // Robe trim
  fillRect(ctx, 0, bodyTop, cols, 1, palette.accent);

  // Neck
  fillRect(ctx, Math.floor(cols / 2) - 1, bodyTop - 2, 2, 3, palette.fg);

  // Head
  const headY = Math.floor(rows * 0.42);
  fillEllipse(ctx, Math.floor(cols / 2), headY,
              Math.floor(cols * 0.22), Math.floor(rows * 0.22), palette.fg);

  // Eyes
  fillRect(ctx, Math.floor(cols * 0.4) - 1, headY, 1, 1, '#0a0a0a');
  fillRect(ctx, Math.floor(cols * 0.6), headY, 1, 1, '#0a0a0a');

  // Crown
  const crownY = headY - Math.floor(rows * 0.22) - 1;
  const crownW = Math.max(5, Math.floor(cols * 0.4));
  fillRect(ctx, Math.floor((cols - crownW) / 2), crownY, crownW, 3, palette.accent);
  // Crown spikes
  for (let i = 0; i < 5; i++) {
    fillRect(ctx, Math.floor((cols - crownW) / 2) + i * Math.floor(crownW / 5),
             crownY - 2 - (i % 2), 1, 2 + (i % 2), palette.accent);
  }
  // Crown gem
  fillRect(ctx, Math.floor(cols / 2) - 1, crownY + 1, 2, 1, '#dc2626');

  // Beard hint
  fillRect(ctx, Math.floor(cols * 0.42), headY + 4, Math.floor(cols * 0.16), 2, palette.mid);
}

const DRAWERS: Record<string, (ctx: DrawContext) => void> = {
  anime: drawAnime,
  castle: drawCastle,
  nature: drawNature,
  abstract: drawAbstract,
  logo: drawLogo,
  portrait: drawPortrait,
  default: drawCastle,
};

// ══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate a compact thumbnail SVG for the gallery card.
 *
 * Renders ONE tile's worth of cells (16×16 = 256 rects) using the
 * category motif. This keeps the /api/products response small (~3 KB per
 * product) so the gallery grid loads fast even with 50 products.
 *
 * The full multi-tile panorama is only fetched on the product-detail
 * page via /api/products/[id], which uses generatePreviewSvg.
 */
export function generateThumbnailSvg(opts: {
  name: string;
  category: string;
  seed?: number;
}): string {
  const { name, category } = opts;
  const seed = opts.seed ?? hashString(name + category);
  const rand = rng(seed);
  const palette = paletteFor(category);
  const drawer = DRAWERS[category.toLowerCase()] ?? DRAWERS.default;

  const cell = 8; // larger cells → fewer total rects
  const cellsPerSide = 16; // 16×16 = 256 rects per thumbnail
  const ctx: DrawContext = {
    cells: [],
    cols: cellsPerSide,
    rows: cellsPerSide,
    cell,
    rand,
    palette,
  };
  drawer(ctx);

  const svgW = cellsPerSide * cell;
  const svgH = cellsPerSide * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  ${ctx.cells.join('\n  ')}
</svg>`;
}

/**
 * Generate an SVG preview for a product.
 *
 * The image is rendered at the FULL product aspect ratio (width:height).
 * For large maps (e.g. 10×6), we tile the same motif across all tiles so
 * the preview reads as a unified panorama, with thin tile-boundary lines
 * overlaid so the multi-tile structure is still visible.
 *
 * NOTE: This generates width×height × 1024 rects — used ONLY on the
 * product detail page (one product at a time). For gallery cards, use
 * generateThumbnailSvg instead.
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
  const drawer = DRAWERS[category.toLowerCase()] ?? DRAWERS.default;

  // Each visual cell is `cell` px in the SVG. For a 1×1 product we render
  // a 16×16 grid (256 cells). For a 10×6 product we render 16×16 PER TILE,
  // so the full canvas is 160×96 cells = 15k cells. SVG scales that
  // down responsively. Larger maps stay performant.
  const cell = 8;
  const cellsPerTile = 16;
  const totalCols = Math.max(width, 1) * cellsPerTile;
  const totalRows = Math.max(height, 1) * cellsPerTile;
  const svgW = totalCols * cell;
  const svgH = totalRows * cell;

  // Render each tile using its own drawer invocation. Per-tile seed
  // varies so each tile is a (subtly) different shot of the same motif —
  // e.g. anime girl's hair extends across tiles, but each tile shows a
  // different chunk.
  const allCells: string[] = [];
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const tileSeed = hashString(`${name}::${category}::${tx}::${ty}`);
      const tileRand = rng(tileSeed);
      const ctx: DrawContext = {
        cells: [],
        cols: cellsPerTile,
        rows: cellsPerTile,
        cell,
        rand: tileRand,
        palette,
      };
      drawer(ctx);
      // Translate this tile's cells into the global SVG coordinate space.
      const offsetX = tx * cellsPerTile * cell;
      const offsetY = ty * cellsPerTile * cell;
      for (const c of ctx.cells) {
        // Rewrite the x/y of each <rect> by inserting a transform on a <g>.
        // Simpler: just shift via a <g> wrapper.
        allCells.push(`<g transform="translate(${offsetX},${offsetY})">${c}</g>`);
      }
    }
  }
  void rand; // rand used inside drawers via ctx

  // Tile grid overlay (for large maps)
  const gridLines: string[] = [];
  if (opts.showTileGrid && (width > 1 || height > 1)) {
    const stroke = 'rgba(0,0,0,0.5)';
    const strokeW = 2;
    for (let i = 1; i < width; i++) {
      const x = i * cellsPerTile * cell;
      gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${svgH}" stroke="${stroke}" stroke-width="${strokeW}"/>`);
    }
    for (let j = 1; j < height; j++) {
      const y = j * cellsPerTile * cell;
      gridLines.push(`<line x1="0" y1="${y}" x2="${svgW}" y2="${y}" stroke="${stroke}" stroke-width="${strokeW}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <filter id="pix" x="0" y="0" width="100%" height="100%">
      <feImage href="data:image/svg+xml;utf8,&lt;svg xmlns='http://www.w3.org/2000/svg'/&gt;"/>
    </filter>
  </defs>
  ${allCells.join('\n  ')}
  ${gridLines.join('\n  ')}
</svg>`;
}

/**
 * Generate a per-tile SVG preview for a single tile inside a larger product.
 * Used by the product-detail "Tile breakdown" view (Phase 15).
 */
export function generateTilePreviewSvg(opts: {
  productName: string;
  category: string;
  posX: number;
  posY: number;
}): string {
  const { productName, category, posX, posY } = opts;
  const tileHashStr = generateTileHash({ productName, category, posX, posY });
  const seed = parseInt(tileHashStr.slice(0, 8), 16);
  const rand = rng(seed);
  const palette = paletteFor(category);
  const drawer = DRAWERS[category.toLowerCase()] ?? DRAWERS.default;

  const cellsPerTile = 16; // 16×16 = 256 rects per tile — keeps 60-tile products under 16k rects total
  const cell = 8;
  const ctx: DrawContext = {
    cells: [],
    cols: cellsPerTile,
    rows: cellsPerTile,
    cell,
    rand,
    palette,
  };
  drawer(ctx);

  const svgW = cellsPerTile * cell;
  const svgH = cellsPerTile * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  ${ctx.cells.join('\n  ')}
</svg>`;
}

// ─── Hash helpers (used by /api/mod/add for duplicate detection) ─────

export function generateTileHash(opts: {
  productName: string;
  category: string;
  posX: number;
  posY: number;
}): string {
  const { productName, category, posX, posY } = opts;
  const base = `${productName}::${category}::${posX}::${posY}`;
  let hex = '';
  let state = hashString(base);
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state ^ (state >>> 13), 0x85ebca6b) + 0x9e3779b9) >>> 0;
    hex += state.toString(16).padStart(8, '0');
  }
  return hex;
}

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
  let state = hashString(productName + '::' + category + '::' + width + 'x' + height);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state ^ (combined.charCodeAt(i * 16) || 0), 0x9e3779b1) + 0x85ebca77) >>> 0;
    hex += state.toString(16).padStart(8, '0');
  }
  return hex;
}

export function generateTileData(opts: {
  productName: string;
  posX: number;
  posY: number;
}): string {
  return `${opts.productName}::${opts.posX}x${opts.posY}`;
}

// ─── REAL Minecraft Map Colour Palette ────────────────────────────────
// 62 base colours × 4 shades = 248 possible colour IDs (0-255).
// From the Minecraft map rendering system — exact match to in-game maps.
const MAP_BASE_COLORS: number[][] = [
  [0, 0, 0], [127, 178, 56], [247, 233, 163], [199, 199, 199],
  [255, 0, 0], [160, 160, 255], [167, 167, 167], [0, 124, 0],
  [255, 255, 255], [164, 168, 184], [151, 109, 77], [112, 112, 112],
  [64, 64, 255], [143, 119, 72], [255, 252, 245], [216, 127, 51],
  [178, 76, 216], [102, 153, 216], [229, 229, 51], [127, 204, 25],
  [242, 127, 165], [76, 76, 76], [153, 153, 153], [76, 127, 153],
  [127, 63, 178], [51, 76, 178], [102, 76, 51], [102, 127, 51],
  [153, 51, 51], [25, 25, 25], [250, 238, 77], [92, 219, 213],
  [74, 128, 255], [0, 217, 58], [129, 86, 49], [112, 2, 0],
  [209, 177, 161], [159, 82, 36], [149, 87, 108], [112, 108, 138],
  [186, 133, 36], [103, 117, 53], [160, 77, 78], [57, 41, 35],
  [135, 107, 98], [87, 92, 92], [122, 73, 88], [76, 62, 92],
  [76, 50, 35], [76, 82, 42], [142, 60, 46], [37, 22, 16],
  [189, 48, 49], [148, 63, 97], [92, 25, 29], [22, 126, 134],
  [58, 142, 140], [86, 44, 62], [20, 180, 133], [100, 100, 100],
  [216, 175, 147], [127, 167, 150], [160, 160, 160],
];

// Shade multipliers: 0=darkest, 1=dark, 2=normal, 3=brightest
const MAP_SHADES = [180, 220, 255, 135];

/** Decode a Minecraft map colour byte (0-255) into an RGB string. */
function decodeMapColor(colorByte: number): string {
  const i = colorByte & 255;
  const baseIdx = Math.floor(i / 4);
  const shadeIdx = i % 4;

  if (baseIdx === 0) return 'rgba(0,0,0,0)'; // transparent (air)

  const base = MAP_BASE_COLORS[baseIdx] ?? [100, 100, 100];
  const mul = MAP_SHADES[shadeIdx];
  const r = Math.floor((base[0] * mul) / 255);
  const g = Math.floor((base[1] * mul) / 255);
  const b = Math.floor((base[2] * mul) / 255);

  return `rgb(${r},${g},${b})`;
}

/**
 * Render actual Minecraft map colour data as an SVG.
 *
 * @param colorData base64-encoded 128×128 byte array (16384 bytes)
 *   Each byte is a Minecraft map colour index.
 * @param scale pixel size in the SVG (default 4 → 512×512 SVG)
 * @returns SVG string showing the real map art
 */
export function renderMapColorData(
  colorData: string,
  scale = 4
): string {
  try {
    // Decode base64 → byte array
    const bytes = Buffer.from(colorData, 'base64');
    if (bytes.length !== 128 * 128) {
      // Not real map data — return empty
      return '';
    }

    const cells: string[] = [];
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const colorByte = bytes[y * 128 + x];
        if (colorByte === 0) continue; // skip transparent
        const fill = decodeMapColor(colorByte);
        cells.push(
          `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="${fill}"/>`
        );
      }
    }

    const svgW = 128 * scale;
    const svgH = 128 * scale;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid slice">
  ${cells.join('\n  ')}
</svg>`;
  } catch {
    return '';
  }
}

/**
 * Check if a tile data string is base64 map colour data (not a placeholder).
 * Placeholders look like "ProductName::0x0". Real data is base64.
 */
export function isRealMapData(tileData: string): boolean {
  if (!tileData || tileData.includes('::')) return false;
  // Base64 strings only contain A-Z, a-z, 0-9, +, /, =
  return /^[A-Za-z0-9+/=]+$/.test(tileData) && tileData.length > 100;
}

