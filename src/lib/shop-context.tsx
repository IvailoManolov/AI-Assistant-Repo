"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CATALOG, type CatalogItem } from "./catalog";

export const STARTING_BALANCE = 50;

export type CartLine = { item: CatalogItem; quantity: number };

export type Purchase = {
  id: string;
  placedAt: string;
  lines: CartLine[];
  total: number;
};

type ShopValue = {
  balance: number;
  cart: CartLine[];
  cartTotal: number;
  cartCount: number;
  purchases: Purchase[];
  add: (id: string) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  purchase: () => { ok: true; purchase: Purchase } | { ok: false; error: string };
  reset: () => void;
};

const ShopContext = createContext<ShopValue | null>(null);

/**
 * All shop state lives here for the length of the tab. There is no store
 * library and no persistence: a reload puts the wallet back to 50.00, which is
 * what you want when you are re-running the same assistant scenario.
 */
export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const add = useCallback((id: string) => {
    const item = CATALOG.find((c) => c.id === id);
    if (!item) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.item.id !== id));
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.item.id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.item.id === id ? { ...l, quantity } : l)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
    [cart],
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity, 0),
    [cart],
  );

  const purchase = useCallback(() => {
    if (cart.length === 0) {
      return { ok: false as const, error: "Your basket is empty." };
    }
    const total = cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
    if (total > balance) {
      const short = total - balance;
      return {
        ok: false as const,
        error: `Your wallet is short by €${short.toFixed(2)}. Remove something, or top up.`,
      };
    }
    const record: Purchase = {
      id: `ORD-${Math.floor(100 + Math.random() * 899)}`,
      placedAt: new Date().toISOString(),
      lines: cart,
      total,
    };
    setBalance((b) => Number((b - total).toFixed(2)));
    setPurchases((p) => [record, ...p]);
    setCart([]);
    return { ok: true as const, purchase: record };
  }, [cart, balance]);

  const reset = useCallback(() => {
    setBalance(STARTING_BALANCE);
    setCart([]);
    setPurchases([]);
  }, []);

  const value = useMemo(
    () => ({
      balance,
      cart,
      cartTotal,
      cartCount,
      purchases,
      add,
      remove,
      setQuantity,
      clearCart,
      purchase,
      reset,
    }),
    [balance, cart, cartTotal, cartCount, purchases, add, remove, setQuantity, clearCart, purchase, reset],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
