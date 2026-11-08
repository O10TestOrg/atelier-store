// Remembers which order this browser is paying for, so the Stripe cancel_url
// can only cancel the shopper's own checkout and a new checkout can release
// the one before it. Knowing an order id isn't enough. Path `/` because
// `startCheckout` runs as a Server Action posted to `/bag`.
//
// It outlives the 31-minute hold so the bag can still tell, days later, that
// a shopper who paid and closed the tab has placed the order (`readBrowserCheckout`).
//
// Setters work only in Server Actions and Route Handlers.
import "server-only";
import { cookies } from "next/headers";
import type { CartLine } from "@/lib/cart";
import { baseCookieOptions } from "@/lib/cookies";
import { getCheckoutOrder, type Order } from "@/lib/orders";

const COOKIE = "pending_checkout";
const MAX_AGE = 60 * 60 * 24 * 7;
// Which order this browser placed, so the confirmation page shows its address
// and items only here (or to the signed-in owner), not to anyone with the link.
const RECEIPT_COOKIE = "checkout_receipt";
const RECEIPT_MAX_AGE = 60 * 60 * 24 * 7;

export async function setPendingCheckout(orderId: string) {
  (await cookies()).set(COOKIE, orderId, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: MAX_AGE,
  });
}

export async function readPendingCheckout() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingCheckout() {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}

export type BrowserCheckout =
  // Still open on Stripe (or abandoned there): its stock is held for this browser.
  | { state: "holding"; order: Order; held: CartLine[] }
  // Finished on Stripe, paid or with a payment still clearing.
  | { state: "placed"; order: Order }
  | null;

// What became of this browser's last checkout. Canceled, expired and failed
// checkouts hold nothing and come back as null.
export async function readBrowserCheckout(): Promise<BrowserCheckout> {
  const orderId = await readPendingCheckout();
  const order = orderId ? await getCheckoutOrder(orderId) : undefined;
  if (!order) return null;
  if (order.status === "paid") return { state: "placed", order };
  if (order.status !== "pending") return null;
  // A shipping address means the shopper finished on Stripe.
  if (order.shippingAddress) return { state: "placed", order };
  const held = order.items.map((item) => ({ slug: item.slug, quantity: item.quantity }));
  return { state: "holding", order, held };
}

export async function setCheckoutReceipt(orderId: string) {
  (await cookies()).set(RECEIPT_COOKIE, orderId, {
    ...baseCookieOptions,
    httpOnly: true,
    path: "/checkout/success",
    maxAge: RECEIPT_MAX_AGE,
  });
}

export async function readCheckoutReceipt() {
  return (await cookies()).get(RECEIPT_COOKIE)?.value ?? null;
}
