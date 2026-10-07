import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

/**
 * PUT /api/products/[id]/reorder-tiles  (REQUIRES AUTH)
 *
 * Rearranges the tile positions of a large map product.
 *
 * Body:
 *   { tiles: [{ id: "tile-cuid", posX: 0, posY: 0 }, ...] }
 *
 * This lets staff fix wrong tile ordering on the web — if they
 * uploaded a 10×6 map with tiles in the wrong order, they can
 * drag-and-drop to rearrange and save the new positions.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tiles: Array<{ id: string; posX: number; posY: number }> = body.tiles;

  if (!Array.isArray(tiles) || tiles.length === 0) {
    return NextResponse.json({ error: 'tiles array is required.' }, { status: 400 });
  }

  // Find the product
  const product = await db.product.findFirst({
    where: { OR: [{ id }, { code: id.toUpperCase() }] },
    include: { tiles: { select: { id: true, posX: true, posY: true } } },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Validate: every tile ID in the request must belong to this product
  const existingTileIds = new Set(product.tiles.map((t) => t.id));
  for (const tile of tiles) {
    if (!existingTileIds.has(tile.id)) {
      return NextResponse.json(
        { error: `Tile ${tile.id} does not belong to product ${product.code}` },
        { status: 400 }
      );
    }
  }

  // Validate: no duplicate positions
  const positions = new Set<string>();
  for (const tile of tiles) {
    const key = `${tile.posX},${tile.posY}`;
    if (positions.has(key)) {
      return NextResponse.json(
        { error: `Duplicate position ${key} — each tile must have a unique position.` },
        { status: 400 }
      );
    }
    positions.add(key);
  }

  // Update each tile's position in a transaction
  await db.$transaction(
    tiles.map((tile) =>
      db.mapTile.update({
        where: { id: tile.id },
        data: { posX: tile.posX, posY: tile.posY },
      })
    )
  );

  // Recompute the product hash since tile positions changed
  const { generateProductHash } = await import('@/lib/pixel-art');
  const newHash = generateProductHash({
    productName: product.name,
    category: product.category,
    width: product.width,
    height: product.height,
  });

  await db.product.update({
    where: { id: product.id },
    data: { mapHash: newHash },
  });

  return NextResponse.json({
    ok: true,
    message: `Reordered ${tiles.length} tiles for ${product.code}`,
    mapHash: newHash,
  });
}
