import { NextRequest, NextResponse } from 'next/server';

/**
 * IP-based rate limiter for brute-force protection.
 *
 * Tracks failed login attempts per IP address. After MAX_FAILURES
 * failed attempts, the IP is locked out for LOCKOUT_MS (with
 * exponential backoff for repeat offenders).
 *
 * Uses an in-memory Map — resets on server restart. For a multi-
 * instance deployment, swap this for a Redis-backed store.
 *
 * The store is cleaned periodically to avoid memory bloat.
 */

interface FailureRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

const MAX_FAILURES = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // 24 hours cap
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STORE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

const store = new Map<string, FailureRecord>();
let lastCleanup = Date.now();

/** Extract the client IP from a request (respects X-Forwarded-For). */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; take the first (client IP)
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/** Check if an IP is currently locked out. Returns the remaining lockout
    time in ms (0 = not locked). */
export function getLockoutRemaining(ip: string): number {
  const record = store.get(ip);
  if (!record || record.lockedUntil === 0) return 0;
  const remaining = record.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

/** Check if an IP can attempt a login. Returns { allowed, remainingMs, attemptsLeft }. */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  remainingMs: number;
  attemptsLeft: number;
} {
  cleanupIfNeeded();
  const remaining = getLockoutRemaining(ip);
  if (remaining > 0) {
    return { allowed: false, remainingMs: remaining, attemptsLeft: 0 };
  }
  const record = store.get(ip);
  const failures = record?.failures ?? 0;
  const attemptsLeft = Math.max(0, MAX_FAILURES - failures);
  return { allowed: true, remainingMs: 0, attemptsLeft };
}

/** Record a failed login attempt for an IP. Locks the IP if threshold reached. */
export function recordFailure(ip: string): void {
  cleanupIfNeeded();
  const now = Date.now();
  let record = store.get(ip);
  if (!record) {
    record = {
      failures: 0,
      firstFailureAt: now,
      lockedUntil: 0,
    };
    store.set(ip, record);
  }

  // If the previous lockout expired, reset the failure count but remember
  // that this IP has been locked before (to escalate the next lockout).
  record.failures += 1;

  if (record.failures >= MAX_FAILURES) {
    // Exponential backoff: each lockout doubles the duration, capped at 24h.
    // Count how many times this IP has hit the threshold.
    const lockoutCount = Math.floor(record.failures / MAX_FAILURES);
    const lockoutMs = Math.min(
      BASE_LOCKOUT_MS * Math.pow(2, lockoutCount - 1),
      MAX_LOCKOUT_MS
    );
    record.lockedUntil = now + lockoutMs;
    // Reset failures to 0 so the next window starts fresh (but the
    // lockout is active, so they can't try again until it expires).
    record.failures = 0;
  }
}

/** Record a successful login — clears the failure history for this IP. */
export function recordSuccess(ip: string): void {
  store.delete(ip);
}

/** Format a lockout duration as a human-readable string. */
export function formatLockout(ms: number): string {
  if (ms < 60_000) return `${Math.ceil(ms / 1000)} seconds`;
  if (ms < 3_600_000) return `${Math.ceil(ms / 60_000)} minutes`;
  return `${Math.ceil(ms / 3_600_000)} hours`;
}

/** Periodically clean up old entries to prevent memory bloat. */
function cleanupIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, record] of store.entries()) {
    // Remove entries older than STORE_TTL_MS with no active lockout
    if (now - record.firstFailureAt > STORE_TTL_MS && record.lockedUntil < now) {
      store.delete(ip);
    }
  }
}
