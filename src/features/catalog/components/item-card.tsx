"use client";

import { Check, Plus } from "lucide-react";
import { eur } from "@/shared";
import { useWallet } from "@/features/wallet";
import type { CatalogItem, Category } from "../model/types";

/**
 * There is no product photography here, so each card carries a glaze swatch
 * instead: the firing colour for its category, taken from a low-chroma
 * earthenware range. Twenty of these have to sit quietly together, and coral
 * is reserved for actions and status, so none of them compete with it.
 */
const GLAZE: Record<Category, { tone: string; sheen: string }> = {
  Table: { tone: "#dccbb4", sheen: "#efe4d4" },
  Kitchen: { tone: "#c8a179", sheen: "#e3c8a8" },
  Glass: { tone: "#b6c8c3", sheen: "#d8e4e0" },
  Carry: { tone: "#a8b2b8", sheen: "#ccd4d8" },
};

export function ItemCard({ item }: { item: CatalogItem }) {
  const { add, balance, cart } = useWallet();
  const inCart = cart.find((l) => l.item.id === item.id);
  const glaze = GLAZE[item.category];
  const unaffordable = item.price > balance;

  return (
    <article className="bg-paper flex flex-col overflow-hidden rounded-xl ring-1 ring-line transition-shadow hover:shadow-soft">
      <div
        className="h-14 shrink-0"
        style={{
          background: `radial-gradient(140% 180% at 22% -40%, ${glaze.sheen}, ${glaze.tone} 70%)`,
        }}
        aria-hidden
      />

      <div className="flex grow flex-col p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[15px] leading-tight font-bold">{item.name}</h3>
          <span className="font-mono text-sm font-medium whitespace-nowrap tabular-nums">
            {eur(item.price)}
          </span>
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-muted">{item.blurb}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-[11px] text-muted">
            {item.material}
            {unaffordable && <span className="mt-0.5 block text-danger">Over your balance</span>}
          </span>
          <button
            type="button"
            onClick={() => add(item.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              inCart
                ? "bg-green-soft text-green hover:bg-green hover:text-white"
                : "bg-ink text-cream hover:bg-coral-deep"
            }`}
          >
            {inCart ? (
              <>
                <Check className="size-3.5" strokeWidth={2.6} />
                {inCart.quantity} added
              </>
            ) : (
              <>
                <Plus className="size-3.5" strokeWidth={2.6} />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
