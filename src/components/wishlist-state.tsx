"use client";

import { useEffect, useSyncExternalStore } from "react";

// Written by the wishlist actions and the sign-in hook (src/lib/wishlist.ts).
// It's display-only: the server never trusts it.
const WISHLIST_COOKIE = "wishlist";
const CHANGE_EVENT = "wishlistchange";

// The server sets the cookie as Secure in production, and browsers won't let a
// non-Secure write replace it.
const secure = () => (location.protocol === "https:" ? "; secure" : "");

// Call after a wishlist action resolves so hearts and the badge re-read it.
export const notifyWishlistChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

// Drops the cookie on sign-out, so a shared browser doesn't keep showing the
// previous account's hearts.
export function clearWishlistCookie() {
  document.cookie = `${WISHLIST_COOKIE}=; path=/; max-age=0${secure()}`;
  notifyWishlistChange();
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab may have changed the wishlist.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

// Returns the raw string so useSyncExternalStore can compare snapshots.
function readCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${WISHLIST_COOKIE}=([^;]*)`));
  return match?.[1] ?? "";
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

const useWishlistCookie = () => useSyncExternalStore(subscribe, readCookie, () => "");

// Prerendered pages show every heart empty; saved ones fill once hydrated.
export function useIsSaved(slug: string) {
  return parse(useWishlistCookie()).includes(slug);
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
    document.cookie =
      value !== "[]"
        ? `${WISHLIST_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure()}`
        : `${WISHLIST_COOKIE}=; path=/; max-age=0${secure()}`;
    notifyWishlistChange();
  }, [value]);
  return null;
}
