import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toProductView } from '@/lib/mappers';
import { CATEGORIES } from '@/lib/sydran';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q')?.toLowerCase();
  const size = url.searchParams.get('size'); // "1x1", "10x6", etc.
  const sort = url.searchParams.get('sort') ?? 'newest';

  const where: Record<string, unknown> = { status: 'active' };
  if (category && category !== 'all') where.category = category;
  if (q) where.name = { contains: q };
  if (size) {
    const m = size.match(/^(\d+)x(\d+)$/);
    if (m) {
      where.width = parseInt(m[1], 10);
      where.height = parseInt(m[2], 10);
    }
  }

  const orderBy: Record<string, 'asc' | 'desc'> =
    sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
        ? { price: 'desc' }
        : { createdAt: 'desc' };

  const products = await db.product.findMany({
    where,
    include: { tiles: { select: { id: true } } },
    orderBy,
  });

  return NextResponse.json({
    products: products.map(toProductView),
    categories: ['all', ...CATEGORIES],
  });
}
