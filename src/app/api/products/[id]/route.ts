import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toProductView } from '@/lib/mappers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Allow lookup by either Prisma id or by code (PRD-XXX).
  const product = await db.product.findFirst({
    where: { OR: [{ id }, { code: id.toUpperCase() }] },
    include: { tiles: { orderBy: [{ posY: 'asc' }, { posX: 'asc' }] } },
  });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json({
    product: toProductView(product),
    tiles: product.tiles.map((t) => ({
      id: t.id,
      posX: t.posX,
      posY: t.posY,
      tileHash: t.tileHash,
    })),
  });
}
