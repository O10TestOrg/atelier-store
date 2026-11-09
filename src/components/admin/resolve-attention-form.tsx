"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Spinner, TextField } from "@/components/admin/fields";
import { SignalMessage } from "@/components/signal";
import type { AdminActionResult } from "@/lib/product-form";

type Props = {
  action: (previous: AdminActionResult, formData: FormData) => Promise<AdminActionResult>;
};

// Clears an order's "needs attention" flag, with a note of what was done,
// which goes into the history.
export function ResolveAttentionForm({ action }: Props) {
  const [result, formAction, pending] = useActionState(action, null);

  // Submitted by hand so the note survives a failed attempt.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending} className="mt-4 flex flex-col gap-4">
      <TextField
        label="What did you do?"
        name="note"
        maxLength={500}
        disabled={pending}
        error={result && !result.ok ? result.message : undefined}
        hint="For example “Refunded in Stripe” or “Restocked and sent by hand”."
        required
      />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          {pending && <Spinner />}
          Mark resolved
        </button>
        <SignalMessage tone="success" role="status">
          {result?.ok ? result.message : ""}
        </SignalMessage>
      </div>
    </form>
  );
}
