import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { pingStaffHeartbeat } from '@/lib/user-auth';

/**
 * POST /api/staff/heartbeat  (REQUIRES STAFF AUTH)
 *   Updates the staff heartbeat timestamp so "Team Sydran online" stays
 *   true. Called automatically by RequireAuth every 2 minutes while a
 *   staff member has a protected page open.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  await pingStaffHeartbeat();
  return NextResponse.json({ ok: true });
}
