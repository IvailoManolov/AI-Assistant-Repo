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
  placing: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  purchase: () => Promise<PurchaseResult>;
  reset: () => void;
};

const WalletContext = createContext<WalletValue | null>(null);

/**
 * Balance and basket for the length of the tab.
 *
 * The balance is browser state on purpose: a reload puts the wallet back to
 * 50.00, which is what you want when re-running the same assistant scenario.
 *
 * The order is not. Buying places a real order on the server, which writes it
 * to the mutable half of the seed, so the assistant can be asked about it a
 * second later and the operator can see it in the Orders view. An earlier
 * version invented an order reference in this file and kept it in React state;
 * it looked like it worked, and nothing outside the tab had ever heard of it.
 */
export function WalletProvider({
  children,
  customerId,
}: {
  children: React.ReactNode;
  customerId: string | null;
}) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [placing, setPlacing] = useState(false);

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

  const purchase = useCallback(async (): Promise<PurchaseResult> => {
    if (cart.length === 0) return { ok: false, error: "Your basket is empty." };
    if (!customerId) {
      return { ok: false, error: "Sign in before buying, so the order has an account." };
    }

    const total = cart.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
    if (total > balance) {
      const short = total - balance;
      return {
        ok: false,
        error: `Your wallet is short by EUR ${short.toFixed(2)}. Remove something, or top up.`,
      };
    }

    setPlacing(true);
    try {
      /**
       * Item ids and quantities only. The server prices the basket from the
       * product master, so a price edited in the browser buys nothing.
       */
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId,
          lines: cart.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
        }),
      });

      const body = (await response.json()) as {
        order?: { orderId: string; totalMinor: number; placedAt: string };
        error?: string;
      };

      if (!response.ok || !body.order) {
        return { ok: false, error: body.error ?? "The order could not be placed." };
      }

      const record: Purchase = {
        id: body.order.orderId,
        placedAt: body.order.placedAt,
        lines: cart,
        /** The server's figure, not the basket's, in case they disagree. */
        total: body.order.totalMinor / 100,
      };

      setBalance((b) => Number((b - record.total).toFixed(2)));
      setPurchases((p) => [record, ...p]);
      setCart([]);
      return { ok: true, purchase: record };
    } catch {
      return { ok: false, error: "The order could not be placed. Nothing was charged." };
    } finally {
      setPlacing(false);
    }
  }, [cart, balance, customerId]);

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
      placing,
      add,
      remove,
      setQuantity,
      clearCart,
      purchase,
      reset,
    }),
    [balance, cart, cartTotal, cartCount, purchases, placing, add, remove, setQuantity, clearCart, purchase, reset],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
