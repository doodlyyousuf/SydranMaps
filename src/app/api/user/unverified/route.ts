import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/user/unverified  (REQUIRES AUTH — staff)
 *
 * Returns all users who haven't been verified yet (paid but
 * payment not detected). Staff can manually verify them from
 * the admin panel.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const users = await db.user.findMany({
    where: { verified: false },
    select: {
      id: true,
      username: true,
      minecraftIgn: true,
      verifyAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}
