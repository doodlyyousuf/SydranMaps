import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  setSessionCookie,
  getAdminPin,
} from '@/lib/auth';
import {
  getClientIp,
  checkRateLimit,
  recordFailure,
  recordSuccess,
  formatLockout,
} from '@/lib/rate-limit';

/**
 * POST /api/auth/login
 *   Body: { pin: "0420" }
 *   Returns 200 + sets httpOnly cookie on success.
 *   Returns 401 if PIN is wrong.
 *   Returns 429 if rate-limited (too many failed attempts).
 *
 * Brute-force protection:
 *   - Tracks failed attempts by IP address
 *   - After 5 failures: 15-minute lockout
 *   - After 10 failures: 30-minute lockout
 *   - After 15 failures: 1-hour lockout
 *   - Exponential backoff up to 24 hours
 *   - Successful login clears the failure history
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // ── Check rate limit first ──────────────────────────────────────
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

  const expectedPin = getAdminPin();
  if (!expectedPin) {
    return NextResponse.json(
      { error: 'Admin PIN is not configured on the server.' },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const pin: string = body.pin ?? '';

  if (typeof pin !== 'string' || pin.length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 characters.' }, { status: 400 });
  }

  if (pin !== expectedPin) {
    recordFailure(ip);
    const updated = checkRateLimit(ip);
    if (!updated.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Locked for ${formatLockout(updated.remainingMs)}.`,
          locked: true,
          remainingMs: updated.remainingMs,
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: 'Wrong PIN.',
        attemptsLeft: updated.attemptsLeft,
      },
      { status: 401 }
    );
  }

  // ── Success ─────────────────────────────────────────────────────
  recordSuccess(ip);
  const { token, expiresAt } = await createSessionToken();
  const res = NextResponse.json({ ok: true, expiresAt });
  setSessionCookie(res, token, expiresAt);
  return res;
}
