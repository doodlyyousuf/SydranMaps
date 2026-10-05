import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateVerifyAmount } from '@/lib/user-auth';

/**
 * POST /api/user/signup
 *   Body: { username, password, minecraftIgn }
 *
 * Creates a user account (unverified). The user must then pay the
 * generated verifyAmount to doodly_yousuf in-game, and the matcher
 * will set verified=true once it detects the payment.
 *
 * Returns the verifyAmount so the frontend can show the /pay command.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username: string = (body.username ?? '').trim().toLowerCase();
  const password: string = body.password ?? '';
  const minecraftIgn: string = (body.minecraftIgn ?? '').trim();

  if (username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–20 chars, lowercase letters/numbers/underscore only.' },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters.' },
      { status: 400 }
    );
  }
  if (minecraftIgn.length < 3 || minecraftIgn.length > 16) {
    return NextResponse.json(
      { error: 'Minecraft username must be 3–16 characters.' },
      { status: 400 }
    );
  }

  // Check uniqueness
  const existing = await db.user.findFirst({
    where: { OR: [{ username }, { minecraftIgn }] },
  });
  if (existing) {
    if (existing.username === username) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Minecraft IGN already registered to another account.' },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const verifyAmount = generateVerifyAmount();

  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      minecraftIgn,
      verified: false,
      verifyAmount,
      balance: 0,
    },
    select: { id: true, username: true, minecraftIgn: true, verifyAmount: true, verified: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
