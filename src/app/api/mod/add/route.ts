import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateThumbnailSvg,
  generateTileHash,
  generateProductHash,
  generateTileData,
} from '@/lib/pixel-art';
import {
  accentFor,
  formatPrice,
  nextProductCode,
} from '@/lib/sydran';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/mod/add  (REQUIRES AUTH — Fabric mod / admin only)
 *   Mirrors the Fabric mod's `/sydran add` upload flow.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const productName: string | undefined = body.productName;
  const description: string | undefined = body.description;

  if (!productName || productName.trim().length < 3) {
    return NextResponse.json(
      { error: 'A product name (≥3 chars) is required.' },
      { status: 400 }
    );
  }

  // Pull the live mod config as the default for price/category/size.
  let cfg = await db.modConfig.findFirst({ where: { id: 'default' } });
  if (!cfg) {
    cfg = await db.modConfig.create({ data: { id: 'default' } });
  }

  const width = Number(body.width ?? cfg.mapWidth);
  const height = Number(body.height ?? cfg.mapHeight);
  const category = (body.category ?? cfg.category).toLowerCase();
  const price = Number(body.price ?? cfg.price);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return NextResponse.json(
      { error: `Invalid size ${width}×${height}.` },
      { status: 400 }
    );
  }
  if (price < 0) {
    return NextResponse.json({ error: 'Price must be ≥ 0.' }, { status: 400 });
  }

  const tiles: Array<{ posX: number; posY: number; tileHash: string }> = body.tiles ?? [];

  // Allow the mod to send raw positional tiles, or to skip sending them
  // (we will derive them from position when simulating).
  const expectedTiles = width * height;
  if (tiles.length > 0 && tiles.length !== expectedTiles) {
    return NextResponse.json(
      {
        error: `Tile count mismatch. Expected ${expectedTiles} tiles for ${width}×${height}, received ${tiles.length}.`,
      },
      { status: 400 }
    );
  }

  // Build canonical tile list with positions preserved exactly.
  const tileRows = Array.from({ length: expectedTiles }, (_, k) => {
    const posX = k % width;
    const posY = Math.floor(k / width);
    const incoming = tiles[k];
    return {
      posX,
      posY,
      tileHash:
        incoming?.tileHash ??
        generateTileHash({ productName, category, posX, posY }),
      tileData: generateTileData({ productName, posX, posY }),
    };
  });

  // ── Server-side duplicate detection (Phase 3 safety net) ─────────────
  const mapHash = generateProductHash({ productName, category, width, height });

  if (cfg.duplicateCheck) {
    const existing = await db.product.findFirst({
      where: { mapHash },
      select: { code: true, name: true, id: true, category: true, width: true, height: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'Duplicate map detected.',
          message: `This map already exists in Sydran Maps.`,
          existingProduct: {
            name: existing.name,
            id: existing.id,
            code: existing.code,
            category: existing.category,
            width: existing.width,
            height: existing.height,
          },
        },
        { status: 409 }
      );
    }
  }

  // ── Insert product + tiles ───────────────────────────────────────────
  const existingCodes = await db.product.findMany({ select: { code: true } });
  const code = nextProductCode(existingCodes.map((p) => p.code));
  const accentColor = accentFor(category);

  // Store thumbnail SVG for gallery cards. The full multi-tile panorama
  // is generated client-side on the product-detail page.
  const previewSvg = generateThumbnailSvg({
    name: productName,
    category,
  });

  const product = await db.product.create({
    data: {
      code,
      name: productName.trim(),
      description: description ?? null,
      category,
      price,
      width,
      height,
      mapHash,
      previewSvg,
      accentColor,
      tags: [category, `${width}x${height}`].join(','),
      status: 'active',
      tiles: { create: tileRows },
    },
    include: { tiles: true },
  });

  // Touch the mod config so lastSyncAt is fresh.
  await db.modConfig.update({
    where: { id: 'default' },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'ok' },
  });

  return NextResponse.json(
    {
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        price: product.price,
        priceLabel: formatPrice(product.price),
        width: product.width,
        height: product.height,
        totalMaps: product.width * product.height,
        mapHash: product.mapHash,
      },
      message: `Uploaded ${product.width * product.height} tiles. Product ${product.code} appears in store.`,
    },
    { status: 201 }
  );
}
