import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * User (customer) authentication helpers.
 *
 * Distinct from /lib/auth.ts which handles staff (PIN-based) auth.
 * Users sign up with a username + password + Minecraft IGN, verify
 * their IGN by paying a random small amount to doodly_yousuf, then
 * can log in once Team Sydran is online.
 */

const ENC = new TextEncoder();

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** Hash a password with a random 16-byte salt. Returns `salt.hash` in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await sha256(ENC.encode(`sydran-user::${password}::` + b64(salt)));
  return `${b64(salt)}.${b64(hash)}`;
}

/** Verify a password against a stored `salt.hash` string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const dot = stored.indexOf('.');
  if (dot < 1) return false;
  const saltB64 = stored.slice(0, dot);
  const expectedB64 = stored.slice(dot + 1);
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = unb64(saltB64);
    expected = unb64(expectedB64);
  } catch {
    return false;
  }
  const hash = await sha256(ENC.encode(`sydran-user::${password}::` + b64(salt)));
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= hash[i] ^ expected[i];
  return diff === 0;
}

// ── Session token (separate from staff session) ─────────────────────

const USER_COOKIE = 'sydran_user';
const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

async function deriveUserSecret(): Promise<Uint8Array> {
  const pin = process.env.ADMIN_PIN ?? 'fallback';
  return sha256(ENC.encode(`sydran-user-session::${pin}`));
}

async function hmac(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const c = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', c, msg));
}

export async function createUserToken(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + USER_SESSION_TTL_MS;
  const payload = ENC.encode(`sydran-user|${userId}|${expiresAt}`);
  const secret = await deriveUserSecret();
  const sig = await hmac(secret, payload);
  return { token: `${userId}.${expiresAt}.${b64(sig)}`, expiresAt };
}

export async function verifyUserToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, sigB64] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const secret = await deriveUserSecret();
  const expected = await hmac(secret, ENC.encode(`sydran-user|${userId}|${expiresAt}`));
  let received: Uint8Array;
  try {
    received = unb64(sigB64);
  } catch {
    return null;
  }
  if (received.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= received[i] ^ expected[i];
  return diff === 0 ? userId : null;
}

export const USER_SESSION_COOKIE = USER_COOKIE;

export function getRequestCookie(req: NextRequest, name: string): string | undefined {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    let v = part.slice(eq + 1).trim();
    if (k === name) {
      try {
        v = decodeURIComponent(v);
      } catch {
        /* leave as-is */
      }
      return v;
    }
  }
  return undefined;
}

export async function getUserId(req: NextRequest): Promise<string | null> {
  const token = getRequestCookie(req, USER_COOKIE);
  return verifyUserToken(token);
}

export function setUserCookie(res: NextResponse, token: string, expiresAt: number): void {
  res.cookies.set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearUserCookie(res: NextResponse): void {
  res.cookies.set(USER_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

// ── Team Sydran online check ─────────────────────────────────────────

const HEARTBEAT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Update the staff heartbeat timestamp. Called whenever a staff member
    loads a protected page (delivery / mod / admin). */
export async function pingStaffHeartbeat(): Promise<void> {
  await db.modConfig.update({
    where: { id: 'default' },
    data: { lastStaffHeartbeat: new Date() },
  });
}

/** Returns true if a staff member has been active in the last 5 min. */
export async function isTeamSydranOnline(): Promise<boolean> {
  const cfg = await db.modConfig.findFirst({ where: { id: 'default' } });
  if (!cfg?.lastStaffHeartbeat) return false;
  return Date.now() - cfg.lastStaffHeartbeat.getTime() < HEARTBEAT_TTL_MS;
}

/** Generate a random verify amount between 1000 and 9999 coins. */
export function generateVerifyAmount(): number {
  return 1000 + Math.floor(Math.random() * 9000);
}
