import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createUserToken, setUserCookie } from '@/lib/user-auth';
import {
  getClientIp,
  checkRateLimit,
  recordFailure,
  recordSuccess,
  formatLockout,
} from '@/lib/rate-limit';

/**
 * POST /api/user/login
 *   Body: { username, password }
 *
 * Verifies credentials and checks the user is verified (IGN payment done).
 *
 * Brute-force protection: same IP-based rate limiting as the staff login.
 * After 5 failed attempts → 15-min lockout (exponential backoff after that).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // ── Rate limit check ────────────────────────────────────────────
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${formatLockout(limit.remainingMs)}.`,
        locked: true,
        remainingMs: limit.remainingMs,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const username: string = (body.username ?? '').trim().toLowerCase();
  const password: string = body.password ?? '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required.' }, { status: 400 });
  }

  const user = await db.user.findFirst({ where: { username } });
  if (!user) {
    recordFailure(ip);
    return NextResponse.json(
      { error: 'Wrong username or password.', attemptsLeft: checkRateLimit(ip).attemptsLeft },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    recordFailure(ip);
    return NextResponse.json(
      { error: 'Wrong username or password.', attemptsLeft: checkRateLimit(ip).attemptsLeft },
      { status: 401 }
    );
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

  // ── Success ─────────────────────────────────────────────────────
  recordSuccess(ip);
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
