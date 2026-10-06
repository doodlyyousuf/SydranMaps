import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/orders/MAP-1042/required-maps  (REQUIRES AUTH)
 *
 * Returns a flat list of all tile hashes required to fulfil the order.
 * The Fabric mod uses this to identify which physical filled maps in
 * the player's inventory / item frames / chests belong to this order,
 * by hashing each map's colour data and comparing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { code } = await params;
  const order = await db.order.findFirst({
    where: { code: code.toUpperCase() },
    include: { items: { include: { product: { include: { tiles: true } } } } },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const requiredMaps = order.items.flatMap((it) =>
    it.product.tiles.map((tile) => ({
      productId: it.product.id,
      productCode: it.product.code,
      productName: it.product.name,
      posX: tile.posX,
      posY: tile.posY,
      tileHash: tile.tileHash,
      width: it.product.width,
      height: it.product.height,
    }))
  );

  return NextResponse.json({
    order: {
      code: order.code,
      player: order.player,
      status: order.status,
    },
    requiredMaps,
  });
}
