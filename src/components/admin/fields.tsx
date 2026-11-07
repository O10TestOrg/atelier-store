"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

// Same label, hint and error wiring as the Field in auth-form.tsx.

const controlClass =
  "block w-full border bg-background px-4 text-body outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:bg-surface disabled:text-muted aria-invalid:border-danger";

type Described = { label: string; error?: string; hint?: ReactNode };

function useDescribed({ error, hint }: Omit<Described, "label">) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    control: {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy || undefined,
    },
  };
}

function Wrapper({
  id,
  label,
  error,
  hint,
  className = "",
  children,
}: Described & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={`text-body-sm ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-caption text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-caption text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: Described & ComponentProps<"input">) {
  const { id, control } = useDescribed({ error, hint });
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <input {...control} className={`h-12 ${controlClass}`} {...props} />
    </Wrapper>
  );
}

export function TextArea({
  label,
  error,
  hint,
  className,
  ...props
}: Described & ComponentProps<"textarea">) {
  const { id, control } = useDescribed({ error, hint });
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <textarea {...control} className={`py-3 ${controlClass}`} {...props} />
    </Wrapper>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: Described & ComponentProps<"select">) {
  const { id, control } = useDescribed({ error, hint });
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} className={className}>
      <select {...control} className={`h-12 ${controlClass}`} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border border-current border-t-transparent"
    />
  );
}
