"use client";

import { Fragment, useId, useMemo, useState, type ReactNode } from "react";

// Collection pages are prerendered (`ensureStatic`), so sorting happens here
// over the cards the server already rendered rather than through a query
// param. Fine at today's catalogue size; move to server-side sorting and
// pagination once a category passes a few dozen pieces.

export type SortableItem = { key: string; price: number; isNew: boolean; card: ReactNode };

const sorts = {
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;

type Sort = keyof typeof sorts;

// `items` arrive in catalogue order (oldest first), which is also "featured".
function sortItems(items: SortableItem[], sort: Sort) {
  const indexed = items.map((item, index) => ({ item, index }));
  const compare: Record<Sort, (a: (typeof indexed)[number], b: (typeof indexed)[number]) => number> = {
    featured: (a, b) => a.index - b.index,
    newest: (a, b) => Number(b.item.isNew) - Number(a.item.isNew) || b.index - a.index,
    "price-asc": (a, b) => a.item.price - b.item.price || a.index - b.index,
    "price-desc": (a, b) => b.item.price - a.item.price || a.index - b.index,
  };
  return indexed.sort(compare[sort]).map(({ item }) => item);
}

export function SortableProductGrid({ items }: { items: SortableItem[] }) {
  const id = useId();
  const [sort, setSort] = useState<Sort>("featured");
  const sorted = useMemo(() => sortItems(items, sort), [items, sort]);

  return (
    <>
      {items.length > 1 && (
        <div className="mb-6 flex items-center justify-end gap-3 text-body-sm">
          <label htmlFor={id} className="text-muted">
            Sort by
          </label>
          <select
            id={id}
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-10 border bg-background px-3 outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong"
          >
            {Object.entries(sorts).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid-products">
        {sorted.map((item) => (
          <Fragment key={item.key}>{item.card}</Fragment>
        ))}
      </div>
    </>
  );
}
