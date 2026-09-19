/**
 * The Robby catalog.
 *
 * This is a view over the product master in data/seed/items.json, not a
 * second source of product truth. A shop listing, an order line, and a refund
 * line all resolve to the same record, which is the point of keeping one file.
 *
 * Unlisted products (ITEM-401, which exists only because a supplied seed order
 * references it) are filtered out here rather than removed from the master.
 *
 * The wallet starts at 50.00, deliberately below several of these and above
 * others: the interesting assistant behaviour lives at that boundary.
 */
import products from "@data/seed/immutable/items.json";

import type { CatalogItem, Category } from "../model/types";

/** Display order for the shop's filter row. */
export const CATEGORIES: Category[] = ["Table", "Kitchen", "Glass", "Carry"];

const isCategory = (value: string): value is Category =>
  (CATEGORIES as string[]).includes(value);

export const CATALOG: CatalogItem[] = products
  .filter((product) => product.listed)
  .map((product) => {
    if (!isCategory(product.category)) {
      throw new Error(
        `${product.item_id} is listed under "${product.category}", which the shop has no filter for.`,
      );
    }
    return {
      id: product.item_id,
      name: product.name,
      blurb: product.blurb,
      price: product.unit_price_minor / 100,
      category: product.category,
      material: product.material,
    };
  });
