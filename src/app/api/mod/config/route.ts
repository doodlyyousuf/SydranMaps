import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parsePrice, parseSize, CATEGORIES } from '@/lib/sydran';
import { isAuthed } from '@/lib/auth';

/**
 * GET /api/mod/config  (REQUIRES AUTH)
 *   Returns the current Fabric mod configuration.
 *
 * PUT /api/mod/config  (REQUIRES AUTH)
 *   Updates the live mod config.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
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
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
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
