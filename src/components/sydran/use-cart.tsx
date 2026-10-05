'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Tiny cart store, shared via React Context so the header badge and the
 * cart page see the same lines.
 *
 * Uses localStorage so a customer's cart survives reloads — important
 * because the typical Sydran Maps purchase flow involves the player
 * alt-tabbing to Minecraft to wire coins before checking out.
 */

export interface CartLine {
  productId: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  width: number;
  height: number;
  totalMaps: number;
  previewSvg: string;
  quantity: number;
}

const STORAGE_KEY = 'sydran-cart-v1';

function load(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
}

interface CartContextValue {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  total: number;
  totalMaps: number;
  count: number;
  hydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load on mount (deferred via microtask to satisfy the React 19 rule
  // against synchronous setState inside an effect body).
  useEffect(() => {
    queueMicrotask(() => {
      setLines(load());
      setHydrated(true);
    });
  }, []);

  // Persist on change (also deferred).
  useEffect(() => {
    if (!hydrated) return;
    queueMicrotask(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
      } catch {
        /* ignore quota / privacy mode errors */
      }
    });
  }, [lines, hydrated]);

  const add = useCallback(
    (line: Omit<CartLine, 'quantity'>, quantity = 1) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.productId === line.productId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
          return next;
        }
        return [...prev, { ...line, quantity }];
      });
    },
    []
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId ? { ...l, quantity: Math.max(0, quantity) } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totalMaps = lines.reduce((s, l) => s + l.totalMaps * l.quantity, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  const value = useMemo<CartContextValue>(
    () => ({ lines, add, setQuantity, remove, clear, total, totalMaps, count, hydrated }),
    [lines, add, setQuantity, remove, clear, total, totalMaps, count, hydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside a <CartProvider>');
  }
  return ctx;
}
