"use client";

import { useActionState } from "react";
import type { CartActionResult } from "@/app/bag/actions";
import { startCheckout } from "@/app/checkout/actions";
import { notifyCartChange } from "@/components/bag-count";

// `expectedTotal` is what the bag shows. The server re-prices from the
// database and only uses it to refuse a total the shopper didn't see.
export function CheckoutButton({ expectedTotal }: { expectedTotal: number }) {
  const [result, formAction, pending] = useActionState<CartActionResult, FormData>(
    async (previous, formData) => {
      const result = await startCheckout(previous, formData);
      // Only reached when checkout didn't redirect; the bag may have changed.
      notifyCartChange();
      return result;
    },
    null,
  );

  // Every line is out of stock: nothing to pay for.
  const unavailable = expectedTotal === 0;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="expectedTotal" value={expectedTotal} />
      <button type="submit" className="btn btn-primary btn-block" disabled={pending || unavailable}>
        {pending && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border border-current border-t-transparent"
          />
        )}
        {pending ? "Redirecting to payment…" : "Checkout"}
      </button>
      <p
        role="status"
        className={`text-body-sm empty:-mt-3 ${unavailable ? "text-muted" : "text-danger"}`}
      >
        {unavailable
          ? "Nothing in your bag is in stock right now."
          : result && !result.ok
            ? result.message
            : null}
      </p>
      {!unavailable && !(result && !result.ok) && (
        <p className="text-meta">You’ll pay securely on Stripe. Your pieces are held for 30 minutes.</p>
      )}
    </form>
  );
}
