import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parsePrice, parseSize, CATEGORIES } from '@/lib/sydran';

/**
 * GET /api/mod/config
 *   Returns the current Fabric mod configuration. This is what the mod
 *   sees when it boots up.
 *
 * PUT /api/mod/config
 *   Updates the live mod config. Used by the equivalent of:
 *     /sydran setprice 1.5m
 *     /sydran setcategory anime
 *     /sydran setsize 10x6
 *     /sydran setduplicate on|off
 *
 *   Body shape (any subset of these keys):
 *     {
 *       price?: "1.5m" | 1500000 | number | string,
 *       category?: "anime",
 *       size?: "10x6",
 *       duplicateCheck?: boolean
 *     }
 */
export async function GET() {
  let cfg = await db.modConfig.findFirst({ where: { id: 'default' } });
  if (!cfg) {
    cfg = await db.modConfig.create({ data: { id: 'default' } });
  }
  return NextResponse.json({
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
    categories: CATEGORIES,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.price !== undefined) {
    const parsed = typeof body.price === 'number' ? body.price : parsePrice(String(body.price));
    if (parsed === null || parsed < 0) {
      return NextResponse.json({ error: `Invalid price: ${body.price}` }, { status: 400 });
    }
    updates.price = parsed;
  }

  if (body.category !== undefined) {
    const cat = String(body.category).toLowerCase();
    if (!CATEGORIES.includes(cat as never)) {
      return NextResponse.json(
        { error: `Invalid category "${cat}". Valid: ${CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.category = cat;
  }

  if (body.size !== undefined) {
    const size = parseSize(String(body.size));
    if (!size) {
      return NextResponse.json({ error: `Invalid size "${body.size}". Expected like "10x6".` }, { status: 400 });
    }
    updates.mapWidth = size.width;
    updates.mapHeight = size.height;
  }

  if (body.duplicateCheck !== undefined) {
    updates.duplicateCheck = Boolean(body.duplicateCheck);
  }

  updates.lastSyncAt = new Date();
  updates.lastSyncStatus = 'ok';

  const updated = await db.modConfig.upsert({
    where: { id: 'default' },
    update: updates,
    create: {
      id: 'default',
      price: typeof updates.price === 'number' ? updates.price : 50_000,
      category: typeof updates.category === 'string' ? updates.category : 'general',
      mapWidth: typeof updates.mapWidth === 'number' ? updates.mapWidth : 1,
      mapHeight: typeof updates.mapHeight === 'number' ? updates.mapHeight : 1,
      duplicateCheck:
        typeof updates.duplicateCheck === 'boolean' ? updates.duplicateCheck : true,
      apiConnected: true,
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });

  return NextResponse.json({
    config: {
      price: updated.price,
      category: updated.category,
      mapWidth: updated.mapWidth,
      mapHeight: updated.mapHeight,
      duplicateCheck: updated.duplicateCheck,
      apiConnected: updated.apiConnected,
      lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: updated.lastSyncStatus,
    },
  });
}
