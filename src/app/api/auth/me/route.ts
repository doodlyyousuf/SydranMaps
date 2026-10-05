import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/auth/me
 *   Returns { authed: true } if the request has a valid session cookie,
 *   { authed: false } otherwise. Used by the frontend to decide whether
 *   to show the Admin / Mod Panel / Delivery nav links.
 */
export async function GET(req: NextRequest) {
  const authed = await isAuthed(req);
  return NextResponse.json({ authed });
}
