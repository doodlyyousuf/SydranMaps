import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createUserToken, setUserCookie } from '@/lib/user-auth';

/**
 * POST /api/user/login
 *   Body: { username, password }
 *
 * Verifies credentials and checks the user is verified (IGN payment done).
 * Login works with just username + password — no Team Sydran online
 * requirement. The IGN verification (paying a small amount to
 * doodly_yousuf) is still required before login is allowed.
 *
 * Returns 401 for wrong credentials.
 * Returns 403 if user not verified yet.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username: string = (body.username ?? '').trim().toLowerCase();
  const password: string = body.password ?? '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required.' }, { status: 400 });
  }

  const user = await db.user.findFirst({ where: { username } });
  if (!user) {
    await new Promise((r) => setTimeout(r, 300)); // slow brute force
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }

  if (!user.verified) {
    return NextResponse.json(
      {
        error: 'Your Minecraft IGN is not verified yet. Pay the verification amount to doodly_yousuf in-game.',
        needsVerification: true,
        verifyAmount: user.verifyAmount,
      },
      { status: 403 }
    );
  }

  const { token, expiresAt } = await createUserToken(user.id);
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      minecraftIgn: user.minecraftIgn,
      balance: user.balance,
    },
  });
  setUserCookie(res, token, expiresAt);
  return res;
}
