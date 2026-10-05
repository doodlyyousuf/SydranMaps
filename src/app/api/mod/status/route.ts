import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatPrice } from '@/lib/sydran';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/mod/status  (REQUIRES AUTH)
 *   Returns the same shape the Fabric mod prints for /sydran status.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  let cfg = await db.modConfig.findFirst({ where: { id: 'default' } });
  if (!cfg) {
    cfg = await db.modConfig.create({ data: { id: 'default' } });
  }

  const lines = [
    'Sydran Maps',
    '──────────────',
    `API: ${cfg.apiConnected ? 'Connected ✓' : 'Disconnected ✗'}`,
    `Size: ${cfg.mapWidth}×${cfg.mapHeight}`,
    `Price: ${formatPrice(cfg.price)}`,
    `Category: ${cfg.category.charAt(0).toUpperCase() + cfg.category.slice(1)}`,
    `Duplicate Check: ${cfg.duplicateCheck ? 'ON' : 'OFF'}`,
  ];

  return NextResponse.json({
    text: lines.join('\n'),
    config: {
      price: cfg.price,
      category: cfg.category,
      mapWidth: cfg.mapWidth,
      mapHeight: cfg.mapHeight,
      duplicateCheck: cfg.duplicateCheck,
      apiConnected: cfg.apiConnected,
      lastSyncAt: cfg.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: cfg.lastSyncStatus,
    },
  });
}
