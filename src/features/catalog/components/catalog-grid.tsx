"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "../data/catalog";
import { ItemCard } from "./item-card";

export function CatalogGrid() {
  const [filter, setFilter] = useState<string>("All");

  const items = useMemo(
    () => (filter === "All" ? CATALOG : CATALOG.filter((i) => i.category === filter)),
    [filter],
  );

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              filter === c
                ? "bg-ink text-cream"
                : "bg-paper text-ink-soft ring-1 ring-line hover:bg-cream-deep"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-muted">{items.length} items</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
