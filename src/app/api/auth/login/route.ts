import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  setSessionCookie,
  getAdminPin,
} from '@/lib/auth';

/**
 * POST /api/auth/login
 *   Body: { pin: "0420" }
 *   Returns 200 + sets httpOnly cookie on success.
 *   Returns 401 if PIN is wrong.
 *
 * Auth is OPTIONAL — if no ADMIN_PIN env var is set, the API returns
 * 503 so the frontend can show a "not configured" message instead of
 * letting anyone in.
 */
export async function POST(req: NextRequest) {
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
    // Constant-time-ish delay to slow down brute force attempts.
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: 'Wrong PIN.' }, { status: 401 });
  }

  const { token, expiresAt } = await createSessionToken();
  const res = NextResponse.json({ ok: true, expiresAt });
  setSessionCookie(res, token, expiresAt);
  return res;
}
