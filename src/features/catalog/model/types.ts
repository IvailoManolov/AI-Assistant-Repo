export type Category = "Table" | "Kitchen" | "Glass" | "Carry";

export type CatalogItem = {
  id: string;
  name: string;
  blurb: string;
  price: number;
  category: Category;
  material: string;
};
