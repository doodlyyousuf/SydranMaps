import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatPrice } from '@/lib/sydran';

/**
 * GET /api/mod/status
 *   Returns the same shape the Fabric mod prints for /sydran status:
 *
 *     Sydran Maps
 *     ──────────────
 *     API: Connected ✓
 *     Size: 10×6
 *     Price: $1.5M
 *     Category: Anime
 *     Duplicate Check: ON
 *
 *   We return both a `text` field (the literal block above, useful for
 *   the in-game console mock) and a structured `config` object.
 */
export async function GET() {
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
