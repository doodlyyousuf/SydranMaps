/**
 * Shared Sydran Maps types and formatting helpers.
 * These mirror the Prisma model shapes and are used by both API and client.
 */

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'claimed'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  claimed: 'Claimed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'awaiting_payment',
  'paid',
  'claimed',
  'delivered',
];

export type ProductStatus = 'active' | 'blocked_duplicate' | 'archived';

export interface ProductView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  width: number;
  height: number;
  totalMaps: number;
  mapHash: string | null;
  previewSvg: string;
  accentColor: string;
  status: ProductStatus;
  blockedBy: string | null;
  tags: string[];
  createdAt: string;
}

export interface OrderItemView {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productPreviewSvg: string;
  quantity: number;
  unitPrice: number;
  width: number;
  height: number;
  totalMaps: number;
}

export interface OrderView {
  id: string;
  code: string;
  player: string;
  totalAmount: number;
  status: OrderStatus;
  paymentRef: string | null;
  paymentMatchedAt: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  deliveredBy: string | null;
  deliveredAt: string | null;
  note: string | null;
  items: OrderItemView[];
  createdAt: string;
  updatedAt: string;
}

export interface ModConfigView {
  price: number;
  category: string;
  mapWidth: number;
  mapHeight: number;
  duplicateCheck: boolean;
  apiConnected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

/**
 * Format a coin amount in the Minecraft-friendly shorthand the roadmap uses.
 * 50000       -> $50K
 * 1500000     -> $1.5M
 * 2000000     -> $2M
 */
export function formatPrice(coins: number): string {
  if (coins >= 1_000_000) {
    const m = coins / 1_000_000;
    const s = Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
    return `$${s}M`;
  }
  if (coins >= 1_000) {
    const k = coins / 1_000;
    const s = Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `$${s}K`;
  }
  return `$${coins}`;
}

/** Format a coin amount with full thousand separators for the detail panel. */
export function formatPriceFull(coins: number): string {
  return `${coins.toLocaleString('en-US')} coins`;
}

/** Parse strings like "150k", "1m", "1.5m", "2000000" into coin amount. */
export function parsePrice(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[$,]/g, '');
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([km]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (Number.isNaN(num) || num < 0) return null;
  if (match[2] === 'k') return Math.round(num * 1_000);
  if (match[2] === 'm') return Math.round(num * 1_000_000);
  return Math.round(num);
}

/** Parse "10x6", "5x3", "2X2" into { width, height }. */
export function parseSize(input: string): { width: number; height: number } | null {
  const m = input.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!w || !h || w > 32 || h > 32) return null;
  return { width: w, height: h };
}

export function sizeLabel(width: number, height: number): string {
  return `${width}×${height}`;
}

export function totalMaps(width: number, height: number): number {
  return width * height;
}

/** Generate the next MAP-XXXX order code based on numeric sequence. */
export function nextOrderCode(existing: string[]): string {
  const nums = existing
    .map((c) => parseInt(c.replace(/^MAP-/i, ''), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 1041; // seed at MAP-1041 to match roadmap examples
  return `MAP-${max + 1}`;
}

export function nextProductCode(existing: string[]): string {
  const nums = existing
    .map((c) => parseInt(c.replace(/^PRD-/i, ''), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `PRD-${String(max + 1).padStart(3, '0')}`;
}

export const CATEGORIES = [
  'anime',
  'castle',
  'nature',
  'abstract',
  'logo',
  'portrait',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function categoryLabel(c: string): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** Minecraft-style accent colors per category, used on cards. */
export const CATEGORY_ACCENTS: Record<string, string> = {
  anime: '#ec4899',
  castle: '#a78bfa',
  nature: '#22c55e',
  abstract: '#06b6d4',
  logo: '#facc15',
  portrait: '#fb923c',
};

export function accentFor(category: string): string {
  return CATEGORY_ACCENTS[category.toLowerCase()] ?? '#10b981';
}
