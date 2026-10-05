import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/delivery/queue
 *   Returns the delivery queue — every order that is currently in
 *   paid / claimed / delivered status with the fields the delivery
 *   team needs at-a-glance: order code, player, status, items with
 *   map-size and total map count, total price, claim/delivery info.
 *
 *   Query params:
 *     ?status=paid|claimed|delivered|all  (default: all active delivery work)
 *     ?assignedTo=USERNAME  (only orders claimed by this delivery member)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') ?? 'active';
  const assignedTo = url.searchParams.get('assignedTo');

  const statuses =
    statusFilter === 'all'
      ? ['paid', 'claimed', 'delivered', 'awaiting_payment', 'cancelled']
      : statusFilter === 'active'
        ? ['paid', 'claimed']
        : [statusFilter];

  const where: Record<string, unknown> = { status: { in: statuses } };
  if (assignedTo) where.claimedBy = assignedTo;

  const orders = await db.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  const queue = orders.map((o) => {
    const totalMaps = o.items.reduce((sum, it) => sum + it.totalMaps, 0);
    return {
      id: o.id,
      code: o.code,
      player: o.player,
      status: o.status,
      totalAmount: o.totalAmount,
      totalMaps,
      // Distinct dimension buckets the delivery team can plan around.
      mapBreakdown: o.items.reduce<Record<string, number>>((acc, it) => {
        const key = `${it.width}×${it.height}`;
        acc[key] = (acc[key] ?? 0) + it.quantity;
        return acc;
      }, {}),
      items: o.items.map((it) => ({
        productCode: it.product.code,
        productName: it.product.name,
        productPreviewSvg: it.product.previewSvg,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        width: it.width,
        height: it.height,
        tileCount: it.width * it.height * it.quantity,
      })),
      claimedBy: o.claimedBy,
      claimedAt: o.claimedAt?.toISOString() ?? null,
      deliveredBy: o.deliveredBy,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    };
  });

  // Summary stats at the top of the queue.
  const summary = {
    total: queue.length,
    paid: queue.filter((q) => q.status === 'paid').length,
    claimed: queue.filter((q) => q.status === 'claimed').length,
    delivered: queue.filter((q) => q.status === 'delivered').length,
    mapsToDeliver: queue
      .filter((q) => q.status === 'paid' || q.status === 'claimed')
      .reduce((s, q) => s + q.totalMaps, 0),
  };

  return NextResponse.json({ queue, summary });
}
