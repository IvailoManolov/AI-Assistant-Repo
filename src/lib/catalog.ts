export type CatalogItem = {
  id: string;
  name: string;
  blurb: string;
  price: number;
  category: "Table" | "Kitchen" | "Glass" | "Carry";
  material: string;
};

/**
 * The Kiln catalog. Prices are EUR.
 *
 * The wallet starts at 50.00, which is deliberately below several items and
 * above others: the interesting assistant behaviour lives at that boundary.
 * The first four entries match the seed order data used by the support
 * exercise so the two halves of the system describe the same shop.
 */
export const CATALOG: CatalogItem[] = [
  { id: "ITEM-101", name: "Ceramic Dinner Set", blurb: "Four plates, four bowls, fired matte.", price: 64.8, category: "Table", material: "Stoneware" },
  { id: "ITEM-201", name: "Wine Glass", blurb: "Thin-walled, unusually light in the hand.", price: 14.9, category: "Glass", material: "Crystal" },
  { id: "ITEM-202", name: "Decanter", blurb: "Wide base, slow pour, no drip.", price: 25.0, category: "Glass", material: "Crystal" },
  { id: "ITEM-301", name: "Travel Mug", blurb: "Holds heat for six hours. Fits one hand.", price: 29.9, category: "Carry", material: "Steel" },
  { id: "ITEM-102", name: "Serving Platter", blurb: "Long enough for a whole fish.", price: 38.0, category: "Table", material: "Stoneware" },
  { id: "ITEM-103", name: "Pasta Bowl", blurb: "Deep well, wide rim, sold singly.", price: 12.5, category: "Table", material: "Stoneware" },
  { id: "ITEM-104", name: "Side Plate", blurb: "The one you actually use every day.", price: 8.4, category: "Table", material: "Stoneware" },
  { id: "ITEM-105", name: "Linen Napkin Set", blurb: "Six, stonewashed, they get better.", price: 22.0, category: "Table", material: "Linen" },
  { id: "ITEM-203", name: "Tumbler", blurb: "Heavy bottom. Reads as a whisky glass.", price: 9.6, category: "Glass", material: "Glass" },
  { id: "ITEM-204", name: "Carafe", blurb: "Water on the table, no ceremony.", price: 18.5, category: "Glass", material: "Glass" },
  { id: "ITEM-205", name: "Champagne Coupe", blurb: "Shallow, 1920s profile, pair.", price: 31.0, category: "Glass", material: "Crystal" },
  { id: "ITEM-401", name: "Cast Iron Pan", blurb: "Pre-seasoned. Will outlive you.", price: 54.0, category: "Kitchen", material: "Cast iron" },
  { id: "ITEM-402", name: "Chef Knife", blurb: "Eight inches, full tang, carbon steel.", price: 72.0, category: "Kitchen", material: "Carbon steel" },
  { id: "ITEM-403", name: "Wooden Spoon", blurb: "Olive wood, cut from one piece.", price: 6.9, category: "Kitchen", material: "Olive wood" },
  { id: "ITEM-404", name: "Pepper Mill", blurb: "Ceramic burr, adjustable to dust.", price: 27.5, category: "Kitchen", material: "Beech" },
  { id: "ITEM-405", name: "Mixing Bowl", blurb: "Three litres, pour spout, grips.", price: 16.2, category: "Kitchen", material: "Stoneware" },
  { id: "ITEM-406", name: "Copper Saucepan", blurb: "Small, tin-lined, for sauces only.", price: 89.0, category: "Kitchen", material: "Copper" },
  { id: "ITEM-302", name: "Lunch Tin", blurb: "Two compartments, seals cold.", price: 21.0, category: "Carry", material: "Steel" },
  { id: "ITEM-303", name: "Water Bottle", blurb: "750ml, narrow mouth, no plastic taste.", price: 19.4, category: "Carry", material: "Steel" },
  { id: "ITEM-304", name: "Canvas Tote", blurb: "Waxed base, carries a full shop.", price: 34.0, category: "Carry", material: "Canvas" },
];

export const CATEGORIES = ["Table", "Kitchen", "Glass", "Carry"] as const;

export const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
