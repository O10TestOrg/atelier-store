"use client";

import { useEffect } from "react";
import { CountBadge } from "@/components/count-badge";
import { HeartIcon } from "@/components/icons";
import { useCookie, writeCookie } from "@/components/use-cookie";
import { WISHLIST_COOKIE, WISHLIST_MAX_AGE, parseWishlist } from "@/lib/cookies";

// The cookie is written by the wishlist actions and the sign-in hook
// (src/lib/wishlist.ts). It's display-only: the server never trusts it.
const CHANGE_EVENT = "wishlistchange";

// Call after a wishlist action resolves so hearts and the badge re-read it.
export const notifyWishlistChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

// Drops the cookie on sign-out, so a shared browser doesn't keep showing the
// previous account's hearts.
export function clearWishlistCookie() {
  writeCookie(WISHLIST_COOKIE, "", 0);
  notifyWishlistChange();
}

// The same parse as the server's, after undoing the cookie's URL encoding.
function parse(raw: string): string[] {
  try {
    return parseWishlist(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

const useWishlistCookie = () => useCookie(WISHLIST_COOKIE, CHANGE_EVENT);

// Prerendered pages show every heart empty; saved ones fill once hydrated.
export function useIsSaved(slug: string) {
  return parse(useWishlistCookie()).includes(slug);
}

// The header heart fills rose once anything is saved, like the product hearts.
export function WishlistHeartIcon() {
  const saved = parse(useWishlistCookie()).length > 0;
  return (
    <HeartIcon
      fill={saved ? "currentColor" : "none"}
      className={`transition-colors ${saved ? "text-heart" : ""}`}
    />
  );
}

export function WishlistCount() {
  const count = parse(useWishlistCookie()).length;

  return <CountBadge label="Wishlist" count={count} />;
}

// Rendered by the wishlist page with the server's list, so hearts match after
// products are deleted or the account was changed on another device.
export function WishlistSync({ slugs }: { slugs: string[] }) {
  const value = JSON.stringify(slugs);
  useEffect(() => {
    writeCookie(WISHLIST_COOKIE, value !== "[]" ? encodeURIComponent(value) : "", WISHLIST_MAX_AGE);
    notifyWishlistChange();
  }, [value]);
  return null;
}
