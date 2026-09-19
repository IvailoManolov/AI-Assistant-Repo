"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CATALOG } from "@/features/catalog";
import type { CartLine, Purchase, PurchaseResult } from "./types";

export const STARTING_BALANCE = 50;

type WalletValue = {
  balance: number;
  cart: CartLine[];
  cartTotal: number;
  cartCount: number;
  purchases: Purchase[];
  add: (id: string) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  purchase: () => PurchaseResult;
  reset: () => void;
};

const WalletContext = createContext<WalletValue | null>(null);

/**
 * Balance, basket and placed orders for the length of the tab. There is no
 * store library and no persistence: a reload puts the wallet back to 50.00,
 * which is what you want when re-running the same assistant scenario.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const add = useCallback((id: string) => {
    const item = CATALOG.find((c) => c.id === id);
    if (!item) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === id);
      if (existing) {
        return prev.map((l) => (l.item.id === id ? { ...l, quantity: l.quantity + 1 } : l));
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
    setCart((prev) => prev.map((l) => (l.item.id === id ? { ...l, quantity } : l)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
    [cart],
  );

  const cartCount = useMemo(() => cart.reduce((sum, l) => sum + l.quantity, 0), [cart]);

  const purchase = useCallback((): PurchaseResult => {
    if (cart.length === 0) {
      return { ok: false, error: "Your basket is empty." };
    }
    const total = cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
    if (total > balance) {
      const short = total - balance;
      return {
        ok: false,
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
    return { ok: true, purchase: record };
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

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
