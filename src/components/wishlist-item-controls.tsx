"use client";

import { useState, useTransition } from "react";
import { clearWishlist, moveToBag, removeFromWishlist } from "@/app/wishlist/actions";
import { notifyCartChange } from "@/components/bag-count";
import { focusAfterRemoval } from "@/components/focus-after-removal";
import { notifyWishlistChange } from "@/components/wishlist-state";
import { SignalMessage } from "@/components/signal";

// Stock is re-checked on the server; `isSoldOut` only disables the bag button.
// Success removes the card, so only errors show here; the rest go to the page.
export function WishlistItemControls({
  slug,
  name,
  isSoldOut,
}: {
  slug: string;
  name: string;
  isSoldOut: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<string | null>) {
    setError(null);
    startTransition(async () => {
      const next = await action();
      notifyCartChange();
      notifyWishlistChange();
      setError(next);
    });
  }

  // `moveToBag` only drops the piece from the wishlist once it's in the bag.
  const move = () =>
    run(async () => {
      const result = await moveToBag(slug);
      if (result.ok) focusAfterRemoval(`${name} moved to your bag.`);
      return result.ok ? null : result.message;
    });

  const remove = () =>
    run(async () => {
      const result = await removeFromWishlist(slug);
      if (result.ok) focusAfterRemoval(`${name} removed from your wishlist.`);
      return result.ok ? null : result.message;
    });

  return (
    <div aria-busy={pending} className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={move}
        disabled={pending || isSoldOut}
        className="btn btn-primary btn-sm btn-block"
        aria-label={isSoldOut ? undefined : `Add ${name} to bag`}
      >
        {isSoldOut ? "Out of stock" : "Add to bag"}
      </button>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="link-quiet disabled:text-muted"
          aria-label={`Remove ${name} from wishlist`}
        >
          Remove
        </button>
      </div>
      {error && (
        <SignalMessage tone="danger" size="caption" role="alert">
          {error}
        </SignalMessage>
      )}
    </div>
  );
}

// Two steps, so one stray click can't empty a signed-in wishlist.
export function ClearWishlistButton() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="link-quiet text-body-sm"
      >
        Clear all
      </button>
    );
  }

  return (
    <span role="group" aria-label="Clear wishlist" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
      <span className="text-muted">Remove every piece?</span>
      <button
        type="button"
        autoFocus
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await clearWishlist();
            notifyWishlistChange();
            focusAfterRemoval("Your wishlist has been cleared.");
          })
        }
        className="link-quiet disabled:text-muted"
      >
        {pending ? "Clearing…" : "Yes, clear all"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="link-quiet disabled:text-muted"
      >
        Keep them
      </button>
    </span>
  );
}
