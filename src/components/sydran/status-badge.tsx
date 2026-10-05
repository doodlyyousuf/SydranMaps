'use client';

import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/sydran';

const STATUS_STYLES: Record<OrderStatus, string> = {
  awaiting_payment:
    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  paid:
    'bg-sky-500/15 text-sky-300 border-sky-500/30',
  claimed:
    'bg-violet-500/15 text-violet-300 border-violet-500/30 sydran-pulse',
  delivered:
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelled:
    'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

interface StatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse = true }: StatusBadgeProps) {
  const s = (status as OrderStatus) ?? 'awaiting_payment';
  const style = STATUS_STYLES[s] ?? STATUS_STYLES.awaiting_payment;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style,
        !pulse && 'sydran-pulse-none',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          s === 'awaiting_payment' && 'bg-amber-400',
          s === 'paid' && 'bg-sky-400',
          s === 'claimed' && 'bg-violet-400',
          s === 'delivered' && 'bg-emerald-400',
          s === 'cancelled' && 'bg-rose-400'
        )}
      />
      {ORDER_STATUS_LABELS[s] ?? status}
    </span>
  );
}
