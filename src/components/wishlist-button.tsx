"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleWishlist } from "@/app/wishlist/actions";
import { HeartIcon } from "@/components/icons";
import { notifyWishlistChange, useIsSaved } from "@/components/wishlist-state";

type Props = {
  slug: string;
  name: string;
  // `icon` sits on product cards; `block` is the product page button.
  variant: "icon" | "block";
  className?: string;
};

// The saved state comes from the readable `wishlist` cookie, so this works on
// fully static pages. The server decides whether the toggle sticks.
export function WishlistButton({ slug, name, variant, className = "" }: Props) {
  const saved = useIsSaved(slug);
  const [shownSaved, setShownSaved] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      setShownSaved(!shownSaved);
      const result = await toggleWishlist(slug);
      notifyWishlistChange();
      if (!result.ok) setError(result.message);
    });
  }

  const heart = (
    <HeartIcon
      fill={shownSaved ? "currentColor" : "none"}
      className={`transition-colors ${shownSaved ? "text-heart" : ""}`}
    />
  );

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={shownSaved}
          aria-busy={pending}
          className={className}
          aria-label={
            shownSaved ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`
          }
        >
          {heart}
        </button>
        {error && (
          <p
            role="alert"
            className="absolute top-13 right-1 left-1 bg-background px-3 py-2 text-caption text-danger"
          >
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={shownSaved}
        aria-busy={pending}
        className={`btn btn-secondary btn-block ${className}`}
      >
        {heart}
        {shownSaved ? "Saved to wishlist" : "Add to wishlist"}
      </button>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
