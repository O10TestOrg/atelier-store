"use client";

import { useActionState } from "react";
import { requestOrderLink, type LookupState } from "@/features/orders/actions";
import { Field } from "@/features/account/auth-form";
import { SignalMessage } from "@/components/signal";

export function OrderLookupForm() {
  const [state, action, pending] = useActionState<LookupState | null, FormData>(
    requestOrderLink,
    null,
  );

  return (
    <form action={action} noValidate aria-busy={pending} className="flex flex-col gap-6">
      <Field
        label="Order reference"
        name="reference"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        error={state?.fieldErrors?.reference}
        disabled={pending}
      />
      <Field
        label="Email used at checkout"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={state?.fieldErrors?.email}
        disabled={pending}
      />
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Sending…" : "Email me a link"}
      </button>
      <SignalMessage
        tone={state?.ok ? "success" : "danger"}
        role="status"
        className="empty:hidden"
      >
        {state?.message ?? ""}
      </SignalMessage>
    </form>
  );
}
