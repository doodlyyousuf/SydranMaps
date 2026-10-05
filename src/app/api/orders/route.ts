import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toOrderView } from '@/lib/mappers';
import { nextOrderCode } from '@/lib/sydran';

/**
 * GET /api/orders
 *   List all orders (used by admin / delivery dashboard).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const player = url.searchParams.get('player');

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;
  if (player) where.player = { contains: player };

  const orders = await db.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ orders: orders.map(toOrderView) });
}

/**
 * POST /api/orders
 *   Create a new order. Body:
 *     { player, items: [{ productId, quantity }] }
 *   New orders start as "awaiting_payment". The order code is generated
 *   server-side as MAP-XXXX.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const player: string | undefined = body.player;
  const items: Array<{ productId: string; quantity: number }> = body.items;

  if (!player || typeof player !== 'string' || player.trim().length < 3) {
    return NextResponse.json(
      { error: 'A valid Minecraft username is required.' },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'Cart must contain at least one item.' },
      { status: 400 }
    );
  }

  // Resolve products and compute totals.
  const productIds = items.map((it) => it.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, status: 'active' },
  });
  if (products.length !== items.length) {
    return NextResponse.json(
      { error: 'One or more products are unavailable.' },
      { status: 400 }
    );
  }

  let totalAmount = 0;
  const orderItemsData = items.map((it) => {
    const product = products.find((p) => p.id === it.productId)!;
    const qty = Math.max(1, Math.floor(it.quantity));
    totalAmount += product.price * qty;
    return {
      productId: product.id,
      quantity: qty,
      unitPrice: product.price,
      width: product.width,
      height: product.height,
      totalMaps: product.width * product.height * qty,
    };
  });

  // Generate next MAP-XXXX code.
  const existing = await db.order.findMany({ select: { code: true } });
  const code = nextOrderCode(existing.map((o) => o.code));

  const order = await db.order.create({
    data: {
      code,
      player: player.trim(),
      totalAmount,
      status: 'awaiting_payment',
      items: { create: orderItemsData },
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ order: toOrderView(order) }, { status: 201 });
}
