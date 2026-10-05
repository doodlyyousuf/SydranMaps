import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toOrderView } from '@/lib/mappers';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/orders/MAP-1042/simulate-payment  (REQUIRES AUTH — admin/dev only)
 *   Mocks the server-side payment matcher that detects an in-game coin
 *   transfer matching an order's amount.
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
  const amount: number | undefined = body.amount;

  const order = await db.order.findFirst({
    where: { code: code.toUpperCase() },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json(
      { error: `Order is already "${order.status}" — cannot simulate payment.` },
      { status: 409 }
    );
  }
  if (typeof amount !== 'number' || amount !== order.totalAmount) {
    return NextResponse.json(
      {
        error: `Amount mismatch. Expected ${order.totalAmount} coins, received ${amount ?? 'nothing'}.`,
      },
      { status: 400 }
    );
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: 'paid',
      paymentRef: `INGAME-${order.code}`,
      paymentMatchedAt: new Date(),
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ order: toOrderView(updated) });
}
