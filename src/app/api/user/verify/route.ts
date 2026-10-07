import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/user/verify  (REQUIRES AUTH — staff/mod)
 *   Body: { username }
 *
 * Verifies a user's Minecraft IGN after payment is confirmed.
 * Called automatically by the mod's ChatPaymentWatcher when it
 * detects a payment in in-game chat matching a user's verifyAmount.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

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
