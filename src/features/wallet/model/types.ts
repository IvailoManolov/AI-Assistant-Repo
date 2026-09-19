import type { CatalogItem } from "@/features/catalog";

export type CartLine = { item: CatalogItem; quantity: number };

export type Purchase = {
  id: string;
  placedAt: string;
  lines: CartLine[];
  total: number;
};

export type PurchaseResult =
  | { ok: true; purchase: Purchase }
  | { ok: false; error: string };
