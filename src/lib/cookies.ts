// Cookie names, options and parsing shared by the server helpers (cart.ts,
// wishlist.ts, pending-checkout.ts) and the client components that read the
// display-only cookies (bag-count.tsx, wishlist-state.tsx). No `server-only`:
// client components import it too, and nothing here is secret.

// Display-only bag size for the header badge, written beside the httpOnly cart.
export const CART_COUNT_COOKIE = "cart_count";
export const WISHLIST_COOKIE = "wishlist";

export const CART_MAX_AGE = 60 * 60 * 24 * 30;
export const WISHLIST_MAX_AGE = 60 * 60 * 24 * 365;

export const baseCookieOptions = {
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

// Cookies hold slugs only; the server looks each one up before using it, so
// this just bounds them.
const MAX_SLUG_LENGTH = 200;

export const isValidSlug = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_SLUG_LENGTH;

// Keeps the wishlist cookie well under the 4 KB limit.
export const MAX_WISHLIST = 50;

// Bad JSON or bad entries yield an empty or shorter list rather than an error.
export function parseWishlist(value: string | null | undefined): string[] {
  if (!value) return [];
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return [...new Set(data.filter(isValidSlug))].slice(0, MAX_WISHLIST);
}
