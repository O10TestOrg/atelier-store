"use client";

import { useActionState, useId } from "react";
import { requestRestockAlert, type RestockAlertResult } from "@/features/restock-alerts/actions";
import { SignalMessage } from "@/components/signal";

// Shown instead of "Add to bag" on sold-out pieces. The product page is
// prerendered, so this can't know who's signed in and just asks for an email.
export function RestockAlertForm({ slug, name }: { slug: string; name: string }) {
  const id = useId();
  const [result, action, pending] = useActionState<RestockAlertResult, FormData>(
    requestRestockAlert.bind(null, slug),
    null,
  );

  if (result?.ok) {
    return (
      <SignalMessage tone="success" role="status" className="border px-4 py-3">
        {result.message}
      </SignalMessage>
    );
  }

  return (
    <form action={action} noValidate aria-busy={pending} className="flex flex-col gap-2 border p-4">
      <label htmlFor={id} className="text-body-sm">
        Email me when the {name} is back
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={pending}
          aria-invalid={result && !result.ok ? true : undefined}
          aria-describedby={`${id}-message`}
          className="h-12 min-w-0 flex-1 border bg-background px-4 text-body outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:bg-surface disabled:text-muted aria-invalid:border-danger"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
          {pending ? "Saving…" : "Notify me"}
        </button>
      </div>
      <SignalMessage
        id={`${id}-message`}
        tone="danger"
        size="caption"
        role="status"
        className="empty:hidden"
      >
        {result?.message ?? ""}
      </SignalMessage>
      <p className="text-caption text-muted">One email, only for this piece.</p>
    </form>
  );
}
