// Remembers which order this browser is paying for, so the Stripe cancel_url
// can only cancel the shopper's own checkout and a new checkout can release
// the one before it. Knowing an order id isn't enough. Path `/` because
// `startCheckout` runs as a Server Action posted to `/bag`.
//
// Setters work only in Server Actions and Route Handlers.
import "server-only";
import { cookies } from "next/headers";
import { baseCookieOptions } from "@/lib/cookies";

const COOKIE = "pending_checkout";
// Which order this browser placed, so the confirmation page shows its address
// and items only here (or to the signed-in owner), not to anyone with the link.
const RECEIPT_COOKIE = "checkout_receipt";
const RECEIPT_MAX_AGE = 60 * 60 * 24 * 7;

export async function setPendingCheckout(orderId: string, expiresAt: Date) {
  (await cookies()).set(COOKIE, orderId, {
    ...baseCookieOptions,
    httpOnly: true,
    expires: expiresAt,
  });
}

export async function readPendingCheckout() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingCheckout() {
  (await cookies()).delete({ name: COOKIE, path: "/" });
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
