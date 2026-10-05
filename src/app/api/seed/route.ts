import { NextResponse } from 'next/server';

/**
 * GET /api/seed
 *   Triggers a database re-seed by shelling out to the seed script.
 *   Used by the "Reset demo data" button in the admin panel.
 *
 *   This is dev-only and would be removed in production.
 */
export async function POST() {
  try {
    const { execFileSync } = await import('child_process');
    const out = execFileSync('bun', ['run', '/home/z/my-project/scripts/seed.ts'], {
      cwd: '/home/z/my-project',
      encoding: 'utf-8',
      timeout: 30_000,
    });
    return NextResponse.json({ ok: true, log: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
