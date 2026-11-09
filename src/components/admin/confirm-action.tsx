"use client";

import { useActionState, useId, useState } from "react";
import { Spinner } from "@/components/admin/fields";
import { SignalMessage } from "@/components/signal";
import type { AdminActionResult } from "@/lib/product-form";

type Props = {
  // A Server Action with its arguments bound; the previous state is ignored.
  action: (previous: AdminActionResult) => Promise<AdminActionResult>;
  label: string;
  // Shown before the action runs, naming what it does to what. Without one,
  // the button acts on the first press.
  confirm?: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  disabledReason?: string;
};

// Literal class names, so Tailwind finds the `@utility` variants.
const variants = { primary: "btn-primary", secondary: "btn-secondary", ghost: "btn-ghost" };

// One button for a bound admin action, with an optional second step that
// spells out the consequence. The server re-checks everything either way.
export function ConfirmAction({
  action,
  label,
  confirm,
  confirmLabel = "Confirm",
  variant = "secondary",
  size = "md",
  disabled,
  disabledReason,
}: Props) {
  const [result, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  const id = useId();
  const sizeClass = size === "sm" ? "btn-sm h-10" : "";

  return (
    <div className="flex flex-col gap-2">
      {asking ? (
        <form
          action={() => {
            setAsking(false);
            formAction();
          }}
          className="flex flex-col gap-3"
        >
          <p id={`${id}-confirm`} className="max-w-prose text-body-sm">
            {confirm}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={`btn btn-primary ${sizeClass}`}
              aria-describedby={`${id}-confirm`}
              // The question just appeared: put the answer under the cursor.
              autoFocus
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              className={`btn btn-ghost ${sizeClass}`}
              onClick={() => setAsking(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form action={formAction}>
          <button
            // With a question to ask, the first press only asks it.
            type={confirm ? "button" : "submit"}
            onClick={confirm ? () => setAsking(true) : undefined}
            className={`btn ${variants[variant]} ${sizeClass}`}
            disabled={pending || disabled}
            title={disabled ? disabledReason : undefined}
          >
            {pending && <Spinner />}
            {label}
          </button>
        </form>
      )}
      {disabled && disabledReason && <p className="text-caption text-muted">{disabledReason}</p>}
      <SignalMessage
        tone={result?.ok ? "success" : "danger"}
        size="caption"
        role="status"
        className="empty:hidden"
      >
        {result?.message}
      </SignalMessage>
    </div>
  );
}
