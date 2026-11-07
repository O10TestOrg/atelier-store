"use server";

import {
  MAX_LINES,
  MAX_QUANTITY,
  isValidSlug,
  maxQuantity,
  readCart,
  reconcileCart,
  writeCart,
  type CartLine,
} from "@/lib/cart";
import { getCartProducts, type Product } from "@/lib/products";

// The bag belongs to the browser, so these don't require a session. Every
// argument is untrusted: validate it before reading the cookie or the DB.

export type CartActionResult = { ok: boolean; message: string } | null;

// Reads the bag and fresh stock for it (plus `extraSlug`), and reconciles the
// stored lines so every write also persists clamping and drops deleted items.
async function loadCart(extraSlug?: string) {
  const stored = await readCart();
  const slugs = stored.map((line) => line.slug);
  if (extraSlug && !slugs.includes(extraSlug)) slugs.push(extraSlug);

  const products = await getCartProducts(slugs);
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return { lines: reconcileCart(stored, products), bySlug };
}

function limitMessage(product: Product, max: number) {
  return max < MAX_QUANTITY
    ? `Only ${max} available. Your bag already holds them all.`
    : `You can order up to ${MAX_QUANTITY} of the ${product.name}.`;
}

export async function addToCart(slug: string): Promise<CartActionResult> {
  if (!isValidSlug(slug)) return { ok: false, message: "Something went wrong. Please try again." };

  const { lines, bySlug } = await loadCart(slug);
  const product = bySlug.get(slug);
  if (!product) {
    await writeCart(lines);
    return { ok: false, message: "This piece is no longer available." };
  }

  const max = maxQuantity(product);
  if (max === 0) {
    await writeCart(lines);
    return { ok: false, message: "This piece is out of stock." };
  }

  const existing = lines.find((line) => line.slug === slug);
  if (existing && existing.quantity >= max) {
    await writeCart(lines);
    return { ok: false, message: limitMessage(product, max) };
  }
  if (!existing && lines.length >= MAX_LINES) {
    return { ok: false, message: "Your bag is full. Remove a piece to add another." };
  }

  const next: CartLine[] = existing
    ? lines.map((line) => (line.slug === slug ? { slug, quantity: line.quantity + 1 } : line))
    : [...lines, { slug, quantity: 1 }];
  await writeCart(next);
  return { ok: true, message: "Added to your bag." };
}

// A quantity of 0 removes the line. Requests above stock are clamped.
export async function updateQuantity(
  slug: string,
  quantity: number,
): Promise<CartActionResult> {
  if (!isValidSlug(slug) || !Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  if (quantity === 0) return removeFromCart(slug);

  const { lines, bySlug } = await loadCart();
  const product = bySlug.get(slug);
  if (!product || !lines.some((line) => line.slug === slug)) {
    await writeCart(lines);
    return { ok: false, message: "This piece is no longer in your bag." };
  }

  const max = maxQuantity(product);
  if (max === 0) {
    await writeCart(lines);
    return { ok: false, message: "This piece is out of stock." };
  }

  const clamped = Math.min(quantity, max);
  await writeCart(
    lines.map((line) => (line.slug === slug ? { slug, quantity: clamped } : line)),
  );
  if (clamped === quantity) return { ok: true, message: "Quantity updated." };
  return {
    ok: false,
    message:
      max < MAX_QUANTITY
        ? `Only ${max} available. Quantity set to ${max}.`
        : `You can order up to ${MAX_QUANTITY} of the ${product.name}.`,
  };
}

export async function removeFromCart(slug: string): Promise<CartActionResult> {
  if (!isValidSlug(slug)) return { ok: false, message: "Something went wrong. Please try again." };

  const { lines } = await loadCart();
  await writeCart(lines.filter((line) => line.slug !== slug));
  return { ok: true, message: "Removed from your bag." };
}
