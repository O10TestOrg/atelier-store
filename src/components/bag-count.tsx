"use client";

import { useEffect } from "react";
import { useCookie, writeCookie } from "@/components/use-cookie";
import { CART_COUNT_COOKIE, CART_MAX_AGE } from "@/lib/cookies";

// The count cookie is written by `writeCart` in src/lib/cart.ts alongside the
// httpOnly cart. It's display-only: the server never trusts it.
const CHANGE_EVENT = "cartchange";

// Call after a cart action resolves so the badge re-reads the cookie.
export const notifyCartChange = () => window.dispatchEvent(new Event(CHANGE_EVENT));

// Prerendered pages show no badge; it appears once hydrated.
export function BagCount() {
  const raw = useCookie(CART_COUNT_COOKIE, CHANGE_EVENT);
  const count = /^\d+$/.test(raw) ? Number(raw) : 0;

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
    writeCookie(CART_COUNT_COOKIE, count > 0 ? String(count) : "", CART_MAX_AGE);
    notifyCartChange();
  }, [count]);
  return null;
}
