import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/user/simulate-verify
 *   Body: { username }
 *
 * Simulates the in-game payment matcher detecting a payment from
 * the user's Minecraft IGN for the exact verifyAmount to doodly_yousuf.
 *
 * In production this would be triggered by the chat/payment listener
 * service. For demo purposes it's a manual trigger.
 *
 * Sets verified=true on the user.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username: string = (body.username ?? '').trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: 'username is required.' }, { status: 400 });
  }

  const user = await db.user.findFirst({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (user.verified) {
    return NextResponse.json({ alreadyVerified: true, user: { username: user.username, minecraftIgn: user.minecraftIgn } });
  }

  // In a real matcher, this is where we'd verify:
  //   - A payment was sent to doodly_yousuf
  //   - The sender IGN matches user.minecraftIgn
  //   - The amount matches user.verifyAmount
  // Here we just mark them verified.
  const updated = await db.user.update({
    where: { id: user.id },
    data: { verified: true },
    select: { id: true, username: true, minecraftIgn: true, verified: true, verifyAmount: true },
  });

  return NextResponse.json({
    ok: true,
    matched: {
      ign: updated.minecraftIgn,
      amount: updated.verifyAmount,
      paidTo: 'doodly_yousuf',
    },
    user: updated,
  });
}
