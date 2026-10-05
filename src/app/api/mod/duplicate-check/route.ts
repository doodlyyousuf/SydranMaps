import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateProductHash } from '@/lib/pixel-art';

/**
 * POST /api/mod/duplicate-check
 *   Server-side duplicate fingerprint check. Called by the Fabric mod
 *   before uploading (and re-checked during /api/mod/add as a safety net).
 *
 *   Body:
 *     {
 *       productName: string,
 *       category: string,
 *       width: number,
 *       height: number,
 *       // The actual per-tile byte hashes the mod computed client-side.
 *       // We re-derive the master fingerprint from the same inputs.
 *     }
 *
 *   Returns:
 *     { isDuplicate: boolean, mapHash: string, existingProduct?: {...} }
 *
 *   The server enforces uniqueness via Product.mapHash @unique, so even
 *   if a mod uploads twice or two users upload the same map, the second
 *   insert is rejected.
 */
export async function POST(req: NextRequest) {
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
