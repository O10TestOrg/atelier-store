// The bag lives in an httpOnly cookie holding only `{ slug, quantity }` pairs.
// Prices, names and stock always come from the database, so the cookie is
// untrusted input: it's re-validated on every read and clamped to stock.
//
// `readCart` reads request cookies, so render callers must sit inside
// <Suspense>. `writeCart` only works in Server Actions and Route Handlers.
//
// `writeCart` also sets a readable `cart_count` cookie for the header badge.
// Product and collection pages must be fully static (`ensureStatic`), so the
// badge can't read the cart on the server and reads that cookie on the client.
import "server-only";
import { cookies } from "next/headers";
import { CART_COUNT_COOKIE, CART_MAX_AGE, baseCookieOptions, isValidSlug } from "@/lib/cookies";
import type { Product } from "@/lib/products";

export type CartLine = { slug: string; quantity: number };

const CART_COOKIE = "cart";
// Keeps the cookie well under the 4 KB limit.
export const MAX_LINES = 30;
// Per-line ceiling on top of stock, so one order can't take a whole shelf.
export const MAX_QUANTITY = 10;


// Most of one product a single line may hold right now.
export const maxQuantity = (product: Product) =>
  Math.max(0, Math.min(product.stock, MAX_QUANTITY));

// Bad JSON or bad entries yield an empty or shorter bag rather than an error.
export function parseCart(value: string | undefined): CartLine[] {
  if (!value) return [];
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const lines = new Map<string, CartLine>();
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { slug, quantity } = entry as Record<string, unknown>;
    if (!isValidSlug(slug) || lines.has(slug)) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      continue;
    }
    lines.set(slug, { slug, quantity: Math.min(quantity, MAX_QUANTITY) });
    if (lines.size === MAX_LINES) break;
  }
  return [...lines.values()];
}

export async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function writeCart(lines: CartLine[]) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    store.delete(CART_COUNT_COOKIE);
    return;
  }

  const kept = lines.slice(0, MAX_LINES);
  const options = { ...baseCookieOptions, maxAge: CART_MAX_AGE };
  store.set(CART_COOKIE, JSON.stringify(kept), { ...options, httpOnly: true });
  const count = kept.reduce((total, line) => total + line.quantity, 0);
  store.set(CART_COUNT_COOKIE, String(count), options);
}

export type BagLine = {
  product: Product;
  // What the bag can actually hold now: the stored quantity clamped to stock.
  quantity: number;
  maxQuantity: number;
  lineTotal: number;
  status: "ok" | "reduced" | "unavailable";
};

export type Bag = {
  lines: BagLine[];
  // Cents. Unavailable lines are left out.
  subtotal: number;
  itemCount: number;
  // Lines whose product no longer exists.
  removedCount: number;
};

export function buildCart(lines: CartLine[], products: Product[]): Bag {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const bag: Bag = { lines: [], subtotal: 0, itemCount: 0, removedCount: 0 };

  for (const line of lines) {
    const product = bySlug.get(line.slug);
    if (!product) {
      bag.removedCount++;
      continue;
    }

    const max = maxQuantity(product);
    const quantity = Math.min(line.quantity, max);
    const status =
      max === 0 ? "unavailable" : quantity < line.quantity ? "reduced" : "ok";
    const lineTotal = product.price * quantity;

    bag.lines.push({ product, quantity, maxQuantity: max, lineTotal, status });
    bag.subtotal += lineTotal;
    bag.itemCount += quantity;
  }
  return bag;
}

// Adds back the stock this browser's own open checkout is holding, so the
// pieces it reserved don't show as sold out to the shopper who reserved them.
// Checking out again releases that hold first (`startCheckout`).
export function creditHeldStock(products: Product[], held: CartLine[]): Product[] {
  if (held.length === 0) return products;
  const heldBySlug = new Map(held.map((line) => [line.slug, line.quantity]));
  return products.map((product) => {
    const quantity = heldBySlug.get(product.slug);
    return quantity ? { ...product, stock: product.stock + quantity } : product;
  });
}

// An order's items as bag lines, to hold or take out of the bag.
export const orderLines = (order: { items: CartLine[] }): CartLine[] =>
  order.items.map(({ slug, quantity }) => ({ slug, quantity }));

// Takes what an order bought out of the bag, keeping anything added since.
export function subtractLines(lines: CartLine[], bought: CartLine[]): CartLine[] {
  const boughtBySlug = new Map(bought.map((line) => [line.slug, line.quantity]));
  return lines.flatMap((line) => {
    const quantity = line.quantity - (boughtBySlug.get(line.slug) ?? 0);
    return quantity > 0 ? [{ slug: line.slug, quantity }] : [];
  });
}

// Drops lines for deleted products and clamps the rest to stock. Out-of-stock
// lines are kept, so the bag can say so and the item can come back.
export function reconcileCart(lines: CartLine[], products: Product[]): CartLine[] {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return lines.flatMap((line) => {
    const product = bySlug.get(line.slug);
    if (!product) return [];
    const max = maxQuantity(product);
    return [{ slug: line.slug, quantity: max === 0 ? line.quantity : Math.min(line.quantity, max) }];
  });
}
