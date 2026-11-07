"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { removeFromCart, updateQuantity } from "@/app/bag/actions";
import { notifyCartChange } from "@/components/bag-count";

type Props = {
  slug: string;
  name: string;
  quantity: number;
  // 0 when the piece is out of stock: only removal is offered.
  maxQuantity: number;
};

// The select's range is a convenience; the server clamps to live stock.
export function BagLineControls({ slug, name, quantity, maxQuantity }: Props) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [shownQuantity, setShownQuantity] = useOptimistic(quantity);
  const [error, setError] = useState<string | null>(null);

  function change(next: number) {
    setError(null);
    startTransition(async () => {
      setShownQuantity(next);
      const result = await updateQuantity(slug, next);
      notifyCartChange();
      if (result && !result.ok) setError(result.message);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeFromCart(slug);
      notifyCartChange();
      if (result && !result.ok) setError(result.message);
    });
  }

  return (
    <div aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {maxQuantity > 0 && (
          <div className="flex items-center gap-3 text-body-sm">
            <label htmlFor={id} className="text-muted">
              Qty
            </label>
            <select
              id={id}
              value={shownQuantity}
              disabled={pending}
              onChange={(event) => change(Number(event.target.value))}
              className="h-10 min-w-16 border bg-background px-3 tabular-nums outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:text-muted"
            >
              {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="link-quiet text-body-sm disabled:text-muted"
          aria-label={`Remove ${name} from bag`}
        >
          Remove
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
