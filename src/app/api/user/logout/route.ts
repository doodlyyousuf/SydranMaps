import { NextResponse } from 'next/server';
import { clearUserCookie } from '@/lib/user-auth';

/** POST /api/user/logout — clears the user session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearUserCookie(res);
  return res;
}
