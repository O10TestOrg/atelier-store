// Signed, expiring links to one order, emailed by the guest order lookup
// (`/orders/lookup`). The token is the order id and expiry plus an HMAC, so
// nothing is stored and a link can't be forged or pointed at another order.
// Keyed from BETTER_AUTH_SECRET with a purpose label, so it can't be swapped
// for any token Better Auth signs.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDER_LINK_HOURS = 72;

function sign(payload: string, secret: string) {
  return createHmac("sha256", `order-link:${secret}`).update(payload).digest("base64url");
}

function getSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return secret;
}

export function createOrderLinkToken(
  orderId: string,
  now = Date.now(),
  secret = getSecret(),
) {
  const expires = Math.floor(now / 1000) + ORDER_LINK_HOURS * 60 * 60;
  const payload = `${orderId}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

// The order id when the token is genuine and unexpired, otherwise null.
export function readOrderLinkToken(
  token: unknown,
  now = Date.now(),
  secret = getSecret(),
): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const [orderId, expires, signature, ...rest] = token.split(".");
  if (!orderId || !expires || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(`${orderId}.${expires}`, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return null;
  return orderId;
}
