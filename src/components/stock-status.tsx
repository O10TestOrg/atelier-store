import { StatusDot, type DotTone } from "@/components/signal";
import { getStockState, type StockState } from "@/lib/catalog";
import type { Product } from "@/lib/products";

const tones: Record<StockState, DotTone> = {
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "danger",
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
      <StatusDot tone={tones[getStockState(product)]} size="md" />
      {stockLabel(product)}
    </p>
  );
}
