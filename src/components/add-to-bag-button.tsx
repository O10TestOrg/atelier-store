"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCart, type CartActionResult } from "@/app/bag/actions";
import { notifyCartChange } from "@/components/bag-count";

// Stock is re-checked on the server, so a stale "In stock" on the cached
// product page still can't add more than is available.
export function AddToBagButton({ slug }: { slug: string }) {
  const [result, formAction, pending] = useActionState<CartActionResult>(
    async () => {
      const result = await addToCart(slug);
      notifyCartChange();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border border-current border-t-transparent"
          />
        )}
        {pending ? "Adding…" : "Add to bag"}
      </button>
      <p
        role="status"
        className={`text-body-sm empty:-mt-3 ${result && !result.ok ? "text-danger" : ""}`}
      >
        {result?.message}
        {result && (
          <>
            {" "}
            <Link href="/bag" className="link">
              View bag
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
