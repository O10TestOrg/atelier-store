"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/bag/actions";
import { clearWishlist, moveToBag, removeFromWishlist } from "@/app/wishlist/actions";
import { notifyCartChange } from "@/components/bag-count";
import { focusAfterRemoval } from "@/components/focus-after-removal";
import { notifyWishlistChange } from "@/components/wishlist-state";
import { SignalMessage } from "@/components/signal";

type Message = { ok: boolean; text: string; toBag: boolean };

// Stock is re-checked on the server; `isSoldOut` only disables the bag buttons.
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
  const [message, setMessage] = useState<Message | null>(null);

  function run(action: () => Promise<Message | null>) {
    setMessage(null);
    startTransition(async () => {
      const next = await action();
      notifyCartChange();
      notifyWishlistChange();
      setMessage(next);
    });
  }

  const addOnly = () =>
    run(async () => {
      const result = await addToCart(slug);
      return result && { ok: result.ok, text: result.message, toBag: true };
    });

  const move = () =>
    run(async () => {
      const result = await moveToBag(slug);
      // A successful move removes the item, so its message goes to the page.
      if (result.ok) focusAfterRemoval(`${name} moved to your bag.`);
      return result.ok ? null : { ok: false, text: result.message, toBag: false };
    });

  const remove = () =>
    run(async () => {
      const result = await removeFromWishlist(slug);
      if (result.ok) focusAfterRemoval(`${name} removed from your wishlist.`);
      return result.ok ? null : { ok: false, text: result.message, toBag: false };
    });

  return (
    <div aria-busy={pending} className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={addOnly}
        disabled={pending || isSoldOut}
        className="btn btn-primary btn-sm btn-block"
      >
        {isSoldOut ? "Out of stock" : "Add to bag"}
      </button>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
        {!isSoldOut && (
          <button
            type="button"
            onClick={move}
            disabled={pending}
            className="link-quiet disabled:text-muted"
            aria-label={`Move ${name} to bag`}
          >
            Move to bag
          </button>
        )}
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
      {message && (
        <SignalMessage
          tone={message.ok ? "success" : "danger"}
          size="caption"
          role={message.ok ? "status" : "alert"}
        >
          {message.text}
          {message.ok && message.toBag && (
            <>
              {" "}
              <Link href="/bag" className="link">
                View bag
              </Link>
            </>
          )}
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
