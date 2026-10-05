import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toOrderView } from '@/lib/mappers';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/orders/MAP-1042/claim  (REQUIRES AUTH — delivery team)
 *   Body: { claimedBy }
 *   Transition: paid -> claimed
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
  const claimedBy: string | undefined = body.claimedBy;

  if (!claimedBy || typeof claimedBy !== 'string' || claimedBy.trim().length < 3) {
    return NextResponse.json(
      { error: 'Delivery member username (claimedBy) is required.' },
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
  if (order.status !== 'paid') {
    return NextResponse.json(
      {
        error: `Only Paid orders can be claimed. This order is currently "${order.status}".`,
      },
      { status: 409 }
    );
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: 'claimed',
      claimedBy: claimedBy.trim(),
      claimedAt: new Date(),
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ order: toOrderView(updated) });
}
