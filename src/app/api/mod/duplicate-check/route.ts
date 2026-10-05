import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateProductHash } from '@/lib/pixel-art';
import { isAuthed } from '@/lib/auth';

/**
 * POST /api/mod/duplicate-check  (REQUIRES AUTH — Fabric mod / admin)
 *   Server-side duplicate fingerprint check.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { productName, category, width, height } = body as {
    productName?: string;
    category?: string;
    width?: number;
    height?: number;
  };

  if (!productName || !category || !width || !height) {
    return NextResponse.json(
      { error: 'productName, category, width, height are required.' },
      { status: 400 }
    );
  }

  const mapHash = generateProductHash({
    productName,
    category,
    width: Number(width),
    height: Number(height),
  });

  const existing = await db.product.findFirst({
    where: { mapHash },
    select: { code: true, name: true, category: true, id: true, width: true, height: true },
  });

  return NextResponse.json({
    isDuplicate: Boolean(existing),
    mapHash,
    existingProduct: existing ?? null,
  });
}
