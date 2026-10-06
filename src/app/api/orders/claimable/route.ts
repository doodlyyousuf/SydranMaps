import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/orders/claimable  (REQUIRES AUTH — delivery team / mod)
 *
 * Returns all orders in "paid" status — these are the orders that
 * delivery members can claim. The Fabric mod calls this from
 * /sydran openorders to list them in the Minecraft chat with
 * clickable [Open Order] + [Claim Order] buttons.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const orders = await db.order.findMany({
    where: { status: 'paid' },
    include: { items: { include: { product: true } } },
    orderBy: { paymentMatchedAt: 'asc' },
  });

  return NextResponse.json({
    orders: orders.map((o) => {
      const totalMaps = o.items.reduce((sum, it) => sum + it.totalMaps, 0);
      return {
        code: o.code,
        player: o.player,
        totalAmount: o.totalAmount,
        totalMaps,
        items: o.items.map((it) => ({
          productCode: it.product.code,
          productName: it.product.name,
          quantity: it.quantity,
          width: it.width,
          height: it.height,
        })),
        paymentMatchedAt: o.paymentMatchedAt?.toISOString() ?? null,
        orderUrl: `/order/${o.code}`,
      };
    }),
  });
}
