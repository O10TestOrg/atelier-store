"use client";

import { useEffect, useRef } from "react";
import { settleCheckout } from "@/features/checkout/actions";

// Rendered by the bag when this browser's checkout was paid on Stripe but the
// shopper never came back through /checkout/return. Rendering can't write
// cookies, so the action does the clean-up and redirects back to the bag.
export function SettleCheckout() {
  const started = useRef(false);
  useEffect(() => {
    // Once only: a second run could take the bought pieces out twice.
    if (started.current) return;
    started.current = true;
    void settleCheckout();
  }, []);
  return null;
}

// The bag's checkout notice is a one-off: drop its query params once shown, so
// it doesn't come back with every quantity change or reload.
export function ClearCheckoutParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("checkout")) return;
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
