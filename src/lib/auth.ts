import { NextRequest, NextResponse } from 'next/server';

/**
 * Minimal session-token helper.
 *
 * We don't need full NextAuth for a single shared admin PIN. Instead we
 * issue a signed cookie on login and verify it on every protected route.
 *
 * The token is `HMAC-SHA256(secret, payload)` where payload encodes the
 * expiry timestamp. The secret is derived from ADMIN_PIN so changing the
 * PIN also invalidates all existing sessions.
 *
 * This runs only on the server — the secret never reaches the browser.
 */

const ENC = new TextEncoder();

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
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

async function deriveSecret(): Promise<Uint8Array> {
  const pin = process.env.ADMIN_PIN ?? 'changeme';
  return sha256(ENC.encode(`sydran-maps-session::${pin}`));
}

const COOKIE_NAME = 'sydran_admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function createSessionToken(): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = ENC.encode(`sydran-admin|${expiresAt}`);
  const secret = await deriveSecret();
  const sig = await hmac(secret, payload);
  const token = `${expiresAt}.${b64(sig)}`;
  return { token, expiresAt };
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expiresAtStr = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const secret = await deriveSecret();
  const expected = await hmac(secret, ENC.encode(`sydran-admin|${expiresAt}`));
  let received: Uint8Array;
  try {
    received = unb64(sigB64);
  } catch {
    return false;
  }
  if (received.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= received[i] ^ expected[i];
  }
  return diff === 0;
}

export const SESSION_COOKIE = COOKIE_NAME;

/** Read the admin PIN env var. Returns null if unset (auth disabled). */
export function getAdminPin(): string | null {
  const pin = process.env.ADMIN_PIN;
  if (!pin || pin.length < 4) return null;
  return pin;
}

export function getRequestCookie(req: NextRequest, name: string): string | undefined {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    let v = part.slice(eq + 1).trim();
    if (k === name) {
      // NextResponse.cookies.set URL-encodes the value, so the cookie
      // header may contain %-encoded characters. Decode it back.
      try {
        v = decodeURIComponent(v);
      } catch {
        /* leave as-is if malformed */
      }
      return v;
    }
  }
  return undefined;
}

export async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = getRequestCookie(req, SESSION_COOKIE);
  return verifySessionToken(token);
}

/** Helper to set the cookie on a response. */
export function setSessionCookie(res: NextResponse, token: string, expiresAt: number): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
