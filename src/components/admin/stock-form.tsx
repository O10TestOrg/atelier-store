"use client";

import { startTransition, useActionState, useId, type FormEvent } from "react";
import type { StockActionResult } from "@/app/admin/products/actions";
import { Spinner } from "@/components/admin/fields";
import { PRODUCT_LIMITS } from "@/lib/product-form";
import { SignalMessage } from "@/components/signal";

type Props = {
  action: (previous: StockActionResult, formData: FormData) => Promise<StockActionResult>;
  // The stock this page was rendered with. The server only applies a change
  // while the row still holds it, so a stale form can't undo a checkout.
  stock: number;
  productName: string;
  layout?: "inline" | "stacked";
};

export function StockForm({ action, stock, productName, layout = "inline" }: Props) {
  const [result, formAction, pending] = useActionState(action, null);
  const id = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const inline = layout === "inline";

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
      <div className={`flex items-end gap-2 ${inline ? "" : "flex-wrap"}`}>
        <div className={inline ? "" : "text-body-sm"}>
          <label htmlFor={id} className={inline ? "sr-only" : "mb-2 block"}>
            {inline ? `Stock for ${productName}` : "Units in stock"}
          </label>
          <input type="hidden" name="expectedStock" value={stock} />
          <input
            // Remounts with the fresh value after the page refreshes.
            key={stock}
            id={id}
            name="stock"
            type="number"
            inputMode="numeric"
            min={0}
            max={PRODUCT_LIMITS.stock}
            step={1}
            defaultValue={stock}
            disabled={pending}
            aria-invalid={result && !result.ok ? true : undefined}
            aria-describedby={`${id}-status`}
            className={`block border bg-background px-3 text-body tabular-nums outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:bg-surface aria-invalid:border-danger ${inline ? "h-10 w-20" : "h-12 w-32"}`}
          />
        </div>
        <button
          type="submit"
          className={`btn btn-secondary ${inline ? "btn-sm h-10" : ""}`}
          disabled={pending}
        >
          {pending && <Spinner />}
          {pending ? "Saving…" : inline ? "Set" : "Update stock"}
        </button>
      </div>
      <SignalMessage
        id={`${id}-status`}
        tone={result?.ok ? "success" : "danger"}
        size="caption"
        role="status"
        className="mt-1 empty:hidden"
      >
        {result?.message}
      </SignalMessage>
    </form>
  );
}
