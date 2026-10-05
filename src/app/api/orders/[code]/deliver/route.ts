import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toOrderView } from '@/lib/mappers';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/orders/MAP-1042/deliver  (REQUIRES AUTH — delivery team)
 *   Body: { deliveredBy }
 *   Transition: claimed -> delivered
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const deliveredBy: string | undefined = body.deliveredBy;

  if (!deliveredBy || typeof deliveredBy !== 'string') {
    return NextResponse.json(
      { error: 'deliveredBy is required.' },
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
      {
        error: `Only Claimed orders can be marked as delivered. Current status: "${order.status}".`,
      },
      { status: 409 }
    );
  }
  if (order.claimedBy && order.claimedBy !== deliveredBy) {
    return NextResponse.json(
      { error: `Only ${order.claimedBy} (the claimant) can mark this order as delivered.` },
      { status: 403 }
    );
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: 'delivered',
      deliveredBy,
      deliveredAt: new Date(),
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ order: toOrderView(updated) });
}
