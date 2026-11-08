"use client";

import { useEffect } from "react";
import { HeartIcon } from "@/components/icons";
import { useCookie, writeCookie } from "@/components/use-cookie";
import { WISHLIST_COOKIE, WISHLIST_MAX_AGE } from "@/lib/cookies";

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

function parse(raw: string): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(data) ? data.filter((slug) => typeof slug === "string") : [];
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

  return (
    <>
      <span className="sr-only">
        Wishlist{count > 0 && `, ${count} ${count === 1 ? "item" : "items"}`}
      </span>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-foreground px-1 text-[0.625rem] leading-none text-background tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </>
  );
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
