import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserId, isTeamSydranOnline } from '@/lib/user-auth';

/**
 * GET /api/user/me
 *   Returns the current logged-in user (or null if not logged in).
 *   Also returns whether Team Sydran is online so the frontend can
 *   show the right state in the UI.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  let user = null;
  if (userId) {
    const found = await db.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        minecraftIgn: true,
        balance: true,
        verified: true,
      },
    });
    if (found?.verified) {
      user = found;
    }
  }
  const teamOnline = await isTeamSydranOnline();
  return NextResponse.json({ user, teamOnline });
}
