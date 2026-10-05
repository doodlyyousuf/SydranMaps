import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createUserToken, setUserCookie, isTeamSydranOnline } from '@/lib/user-auth';

/**
 * POST /api/user/login
 *   Body: { username, password }
 *
 * Verifies credentials, checks the user is verified (IGN payment done),
 * and checks that Team Sydran is online (at least one staff member
 * active in the last 5 min). If all checks pass, sets a session cookie.
 *
 * Returns 401 for wrong credentials.
 * Returns 403 if user not verified yet or Team Sydran is offline.
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

  // Team Sydran online check — block login if no staff is online.
  const teamOnline = await isTeamSydranOnline();
  if (!teamOnline) {
    return NextResponse.json(
      {
        error: 'Team Sydran is offline. Login is disabled until a staff member is online.',
        teamOffline: true,
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
