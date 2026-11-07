// Remembers which order this browser is paying for, so the Stripe cancel_url
// can only cancel the shopper's own checkout. Knowing an order id isn't enough.
//
// Works only in Server Actions and Route Handlers.
import "server-only";
import { cookies } from "next/headers";

const COOKIE = "pending_checkout";

export async function setPendingCheckout(orderId: string, expiresAt: Date) {
  (await cookies()).set(COOKIE, orderId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/checkout",
    expires: expiresAt,
  });
}

export async function readPendingCheckout() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingCheckout() {
  (await cookies()).delete({ name: COOKIE, path: "/checkout" });
}
