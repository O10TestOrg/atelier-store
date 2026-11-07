"use client";

import { useEffect, useSyncExternalStore } from "react";

// Written by `writeCart` in src/lib/cart.ts alongside the httpOnly cart. It's
// display-only: the server never trusts it.
const COUNT_COOKIE = "cart_count";
const CHANGE_EVENT = "cartchange";

// Call after a cart action resolves so the badge re-reads the cookie.
export const notifyCartChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab may have changed the bag.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

function readCount() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COUNT_COOKIE}=(\\d+)`));
  return match ? Number(match[1]) : 0;
}

// Prerendered pages show no badge; it appears once hydrated.
export function BagCount() {
  const count = useSyncExternalStore(subscribe, readCount, () => 0);

  return (
    <>
      <span className="sr-only">
        Shopping bag{count > 0 && `, ${count} ${count === 1 ? "item" : "items"}`}
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

// Rendered by the bag page with the reconciled count, so the badge matches
// after stock changes or deleted products, which only the server can see.
export function BagCountSync({ count }: { count: number }) {
  useEffect(() => {
    document.cookie =
      count > 0
        ? `${COUNT_COOKIE}=${count}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
        : `${COUNT_COOKIE}=; path=/; max-age=0`;
    notifyCartChange();
  }, [count]);
  return null;
}
