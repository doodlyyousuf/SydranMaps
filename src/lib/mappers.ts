/**
 * Helper to map a Prisma Product row into the ProductView shape sent to clients.
 * Lives on the server side (uses @/lib/db).
 */
import { Prisma } from '@prisma/client';
import type { ProductView } from '@/lib/sydran';

type ProductWithTiles = Prisma.ProductGetPayload<{
  include: { tiles: true };
}>;

export function toProductView(p: ProductWithTiles): ProductView {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    width: p.width,
    height: p.height,
    totalMaps: p.width * p.height,
    mapHash: p.mapHash,
    previewSvg: p.previewSvg,
    accentColor: p.accentColor,
    status: p.status as ProductView['status'],
    blockedBy: p.blockedBy,
    tags: (p.tags ?? '').split(',').filter(Boolean),
    createdAt: p.createdAt.toISOString(),
  };
}

type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: { product: true };
    };
  };
}>;

export function toOrderView(o: OrderWithItems) {
  return {
    id: o.id,
    code: o.code,
    player: o.player,
    totalAmount: o.totalAmount,
    status: o.status,
    paymentRef: o.paymentRef,
    paymentMatchedAt: o.paymentMatchedAt?.toISOString() ?? null,
    claimedBy: o.claimedBy,
    claimedAt: o.claimedAt?.toISOString() ?? null,
    deliveredBy: o.deliveredBy,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    note: o.note,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productCode: it.product.code,
      productName: it.product.name,
      productPreviewSvg: it.product.previewSvg,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      width: it.width,
      height: it.height,
      totalMaps: it.totalMaps,
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
