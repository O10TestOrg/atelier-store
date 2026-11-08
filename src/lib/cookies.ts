// Cookie names and options shared by the server helpers (cart.ts, wishlist.ts,
// pending-checkout.ts) and the client components that read the display-only
// cookies (bag-count.tsx, wishlist-state.tsx). No `server-only`: client
// components import it too, and nothing here is secret.

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
