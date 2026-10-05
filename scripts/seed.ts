/**
 * Seeds the Sydran Maps database with realistic sample data:
 *   - ModConfig (single row)
 *   - 8 products across all dimension tiers (1x1, 2x2, 5x3, 10x6)
 *   - MapTile rows for every product (correctly preserving posX/posY)
 *   - 4 orders across every lifecycle stage (awaiting_payment, paid, claimed, delivered)
 *
 * Run with: bun run /home/z/my-project/scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  generatePreviewSvg,
  generateTileHash,
  generateProductHash,
  generateTileData,
} from '../src/lib/pixel-art';
import {
  accentFor,
  nextOrderCode,
  nextProductCode,
} from '../src/lib/sydran';

const db = new PrismaClient();

interface SeedProduct {
  name: string;
  description: string;
  category: string;
  price: number;
  width: number;
  height: number;
}

const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: 'Anime Girl #42',
    description:
      'Classic anime portrait. Compact 1×1 map, perfect for small walls or desktop display cases.',
    category: 'anime',
    price: 50_000,
    width: 1,
    height: 1,
  },
  {
    name: 'Sunset Vibe',
    description:
      'Warm sunset gradient with palm silhouettes. Single-tile decorative piece.',
    category: 'abstract',
    price: 80_000,
    width: 1,
    height: 1,
  },
  {
    name: 'Creeper Face',
    description:
      'Iconic creeper face. A fan-favourite for any survival base entrance.',
    category: 'logo',
    price: 75_000,
    width: 1,
    height: 1,
  },
  {
    name: 'Forest Glade',
    description:
      'Peaceful forest biome captured in 2×2 — four tiles, one serene image.',
    category: 'nature',
    price: 220_000,
    width: 2,
    height: 2,
  },
  {
    name: 'Sakura Tree',
    description:
      'Pink cherry blossom blooming against a twilight sky. A 2×2 fan favourite.',
    category: 'anime',
    price: 280_000,
    width: 2,
    height: 2,
  },
  {
    name: 'Mountain Range',
    description:
      'A wide 5×3 panorama of snowy peaks and alpine lakes. Great above beds or in hallways.',
    category: 'nature',
    price: 850_000,
    width: 5,
    height: 3,
  },
  {
    name: 'Stone Keep',
    description:
      'Detailed medieval castle in 5×3. Each brick hand-placed, every banner crisp.',
    category: 'castle',
    price: 920_000,
    width: 5,
    height: 3,
  },
  {
    name: 'Anime Castle',
    description:
      'The flagship commission. A 10×6 panorama combining anime aesthetic with castle architecture. Sixty tiles of pixel-art perfection.',
    category: 'castle',
    price: 1_500_000,
    width: 10,
    height: 6,
  },
  {
    name: 'Cyber Skyline',
    description:
      'Neon-soaked cyberpunk skyline across a 10×6 canvas. Best paired with dark interiors.',
    category: 'abstract',
    price: 1_750_000,
    width: 10,
    height: 6,
  },
  {
    name: 'Royal Portrait',
    description:
      'Stylized 5×3 portrait of a crowned figure. 15 tiles of regal detail.',
    category: 'portrait',
    price: 780_000,
    width: 5,
    height: 3,
  },
];

interface SeedOrder {
  player: string;
  productIndex: number;
  quantity: number;
  status: 'awaiting_payment' | 'paid' | 'claimed' | 'delivered';
  claimedBy?: string;
  deliveredBy?: string;
  note?: string;
  createdAt?: Date;
}

const SEED_ORDERS: SeedOrder[] = [
  {
    player: 'Doodly_yousuf',
    productIndex: 7, // Anime Castle 10x6
    quantity: 1,
    status: 'paid',
    note: 'Discord order link sent to delivery channel.',
  },
  {
    player: 'RealSwitchy',
    productIndex: 5, // Mountain Range 5x3
    quantity: 1,
    status: 'claimed',
    claimedBy: 'RealSwitchy',
    note: 'Claimed for delivery — building in survival.',
  },
  {
    player: 'MiniMinecraft',
    productIndex: 3, // Forest Glade 2x2
    quantity: 2,
    status: 'delivered',
    deliveredBy: 'PixelPusher',
    note: 'Delivered to player base coordinates -123, 64, 456.',
  },
  {
    player: 'BlockBuilder99',
    productIndex: 4, // Sakura Tree 2x2
    quantity: 1,
    status: 'awaiting_payment',
    note: 'Awaiting in-game coin transfer.',
  },
  {
    player: 'CraftyCarla',
    productIndex: 8, // Cyber Skyline 10x6
    quantity: 1,
    status: 'claimed',
    claimedBy: 'PixelPusher',
    note: 'Tile set verified. Awaiting placement window.',
  },
];

async function main() {
  console.log('→ Seeding Sydran Maps database…');

  // Reset tables so re-seeding is idempotent.
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.mapTile.deleteMany();
  await db.product.deleteMany();
  await db.modConfig.deleteMany();

  // ── ModConfig ─────────────────────────────────────────────────────────
  await db.modConfig.create({
    data: {
      id: 'default',
      price: 1_500_000,
      category: 'castle',
      mapWidth: 10,
      mapHeight: 6,
      duplicateCheck: true,
      apiConnected: true,
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
    },
  });
  console.log('  ✓ ModConfig row created');

  // ── Products + MapTiles ───────────────────────────────────────────────
  const existingProductCodes: string[] = [];
  const createdProducts = [];

  for (let i = 0; i < SEED_PRODUCTS.length; i++) {
    const p = SEED_PRODUCTS[i];
    const code = nextProductCode(existingProductCodes);
    existingProductCodes.push(code);

    const mapHash = generateProductHash({
      productName: p.name,
      category: p.category,
      width: p.width,
      height: p.height,
    });

    const previewSvg = generatePreviewSvg({
      name: p.name,
      category: p.category,
      width: p.width,
      height: p.height,
      seed: i * 17 + 7,
      showTileGrid: p.width > 1 || p.height > 1,
    });

    const product = await db.product.create({
      data: {
        code,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        width: p.width,
        height: p.height,
        mapHash,
        previewSvg,
        accentColor: accentFor(p.category),
        tags: [p.category, `${p.width}x${p.height}`].join(','),
        status: 'active',
        tiles: {
          create: Array.from({ length: p.width * p.height }, (_, k) => {
            const posX = k % p.width;
            const posY = Math.floor(k / p.width);
            return {
              posX,
              posY,
              tileHash: generateTileHash({
                productName: p.name,
                category: p.category,
                posX,
                posY,
              }),
              tileData: generateTileData({ productName: p.name, posX, posY }),
            };
          }),
        },
      },
    });
    createdProducts.push(product);
    console.log(
      `  ✓ Product ${code} — ${p.name} (${p.width}×${p.height}, ${(p.width * p.height).toString().padStart(2, ' ')} tiles)`
    );
  }

  // ── Orders + OrderItems ───────────────────────────────────────────────
  const existingOrderCodes: string[] = [];
  for (let i = 0; i < SEED_ORDERS.length; i++) {
    const o = SEED_ORDERS[i];
    const product = createdProducts[o.productIndex];
    const code = nextOrderCode(existingOrderCodes);
    existingOrderCodes.push(code);

    const totalMaps = product.width * product.height * o.quantity;
    const totalAmount = product.price * o.quantity;
    const now = new Date();
    const createdAt = o.createdAt ?? new Date(now.getTime() - (SEED_ORDERS.length - i) * 86_400_000);

    const claimedAt =
      o.status === 'claimed' || o.status === 'delivered'
        ? new Date(createdAt.getTime() + 3_600_000)
        : null;
    const deliveredAt =
      o.status === 'delivered'
        ? new Date(createdAt.getTime() + 86_400_000)
        : null;
    const paymentMatchedAt =
      o.status !== 'awaiting_payment'
        ? new Date(createdAt.getTime() + 1_800_000)
        : null;

    await db.order.create({
      data: {
        code,
        player: o.player,
        totalAmount,
        status: o.status,
        paymentRef: o.status !== 'awaiting_payment' ? `INGAME-${code}` : null,
        paymentMatchedAt,
        claimedBy: o.claimedBy ?? null,
        claimedAt,
        deliveredBy: o.deliveredBy ?? null,
        deliveredAt,
        note: o.note ?? null,
        createdAt,
        items: {
          create: {
            productId: product.id,
            quantity: o.quantity,
            unitPrice: product.price,
            width: product.width,
            height: product.height,
            totalMaps,
          },
        },
      },
    });
    console.log(
      `  ✓ Order ${code} — ${o.player} × ${product.name} [${o.status}]`
    );
  }

  console.log('\n✓ Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
