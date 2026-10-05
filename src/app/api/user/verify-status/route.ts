import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/user/verify-status?username=xxx
 *   Returns the verification status + verifyAmount for a user.
 *   Used by the signup page to poll whether the payment matcher has
 *   detected the in-game payment yet.
 *
 *   Public (no auth) — only requires the username to look up.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const username = (url.searchParams.get('username') ?? '').trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: 'username is required.' }, { status: 400 });
  }
  const user = await db.user.findFirst({
    where: { username },
    select: {
      username: true,
      minecraftIgn: true,
      verified: true,
      verifyAmount: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  return NextResponse.json({ user });
}
