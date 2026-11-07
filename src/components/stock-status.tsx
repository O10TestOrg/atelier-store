import { getStockState } from "@/lib/catalog";
import type { Product } from "@/lib/products";

const dotClass = {
  "in-stock": "bg-success",
  "low-stock": "bg-warning",
  "out-of-stock": "border border-muted",
};

export function stockLabel(product: Product) {
  switch (getStockState(product)) {
    case "in-stock":
      return "In stock";
    case "low-stock":
      return `Only ${product.stock} left`;
    case "out-of-stock":
      return "Out of stock";
  }
}

export function StockStatus({ product }: { product: Product }) {
  return (
    <p className="flex items-center gap-2 text-body-sm">
      <span
        aria-hidden="true"
        className={`size-2 rounded-pill transition-colors ${dotClass[getStockState(product)]}`}
      />
      {stockLabel(product)}
    </p>
  );
}
