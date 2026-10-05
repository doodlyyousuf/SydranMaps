import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toOrderView } from '@/lib/mappers';

/**
 * POST /api/orders/MAP-1042/unclaim
 *   Body: { requestedBy }
 *   Transition: claimed -> paid
 *   Only the original claimant can unclaim their own order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const requestedBy: string | undefined = body.requestedBy;

  if (!requestedBy) {
    return NextResponse.json(
      { error: 'requestedBy is required.' },
      { status: 400 }
    );
  }

  const order = await db.order.findFirst({
    where: { code: code.toUpperCase() },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'claimed') {
    return NextResponse.json(
      { error: `Only Claimed orders can be unclaimed. Current status: "${order.status}".` },
      { status: 409 }
    );
  }
  if (order.claimedBy !== requestedBy) {
    return NextResponse.json(
      { error: `Only ${order.claimedBy} can unclaim this order.` },
      { status: 403 }
    );
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: 'paid',
      claimedBy: null,
      claimedAt: null,
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ order: toOrderView(updated) });
}
