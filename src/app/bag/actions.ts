"use server";

import {
  MAX_LINES,
  MAX_QUANTITY,
  creditHeldStock,
  isValidSlug,
  maxQuantity,
  readCart,
  reconcileCart,
  writeCart,
  type CartLine,
} from "@/lib/cart";
import { readBrowserCheckout } from "@/lib/pending-checkout";
import { getCartProducts, type Product } from "@/lib/products";
import { findCountry, writeDeliveryCountry } from "@/lib/shipping";

// The bag belongs to the browser, so these don't require a session. Every
// argument is untrusted: validate it before reading the cookie or the DB.

export type CartActionResult = { ok: boolean; message: string } | null;

// Reads the bag and fresh stock for it (plus `extraSlug`), and reconciles the
// stored lines so every write also persists clamping and drops deleted items.
// Stock held by this browser's own open checkout counts as available, as it
// does on the bag page.
async function loadCart(extraSlug?: string) {
  const stored = await readCart();
  const slugs = stored.map((line) => line.slug);
  if (extraSlug && !slugs.includes(extraSlug)) slugs.push(extraSlug);

  const [live, checkout] = await Promise.all([getCartProducts(slugs), readBrowserCheckout()]);
  const products = creditHeldStock(live, checkout?.state === "holding" ? checkout.held : []);
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

  const quantity = (existing?.quantity ?? 0) + 1;
  const next: CartLine[] = existing
    ? lines.map((line) => (line.slug === slug ? { slug, quantity } : line))
    : [...lines, { slug, quantity }];
  await writeCart(next);
  // The count makes each message different, so screen readers announce every
  // add, not just the first.
  return {
    ok: true,
    message: quantity === 1 ? "Added to your bag." : `Added to your bag. You now have ${quantity}.`,
  };
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

// Where the bag prices delivery to, and the only country checkout will accept
// an address in. Unknown codes are refused rather than falling back silently.
export async function setDeliveryCountry(code: string): Promise<CartActionResult> {
  const country = findCountry(code);
  if (!country) return { ok: false, message: "We don’t deliver there yet." };
  await writeDeliveryCountry(country);
  return { ok: true, message: `Delivering to ${country.name}.` };
}
