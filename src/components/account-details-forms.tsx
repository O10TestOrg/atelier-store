"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  EMAIL_PATTERN,
  Field,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/components/auth-form";
import { SignalMessage } from "@/components/signal";
import { clearWishlistCookie } from "@/components/wishlist-state";
import { authClient } from "@/lib/auth-client";

// Self-service account changes through Better Auth's HTTP endpoints, so each
// goes through its session check, origin check and rate limits.

type Result = { ok: boolean; text: string } | null;
type AuthError = { status: number; code?: string } | null;

function errorText(error: NonNullable<AuthError>, fallback: string) {
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (error.code === "INVALID_PASSWORD") return "Your current password is incorrect.";
  if (error.status === 0 || error.status >= 500) {
    return "We couldn't reach Atelier. Check your connection and try again.";
  }
  return fallback;
}

async function call(request: () => Promise<{ error: AuthError }>): Promise<AuthError> {
  try {
    return (await request()).error;
  } catch {
    return { status: 0 };
  }
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-b py-8">
      <h2 id={id} className="text-heading-sm">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-prose text-body-sm text-muted">{description}</p>}
      <div className="mt-6 max-w-md">{children}</div>
    </section>
  );
}

function Feedback({ result }: { result: Result }) {
  return (
    <SignalMessage
      tone={result?.ok ? "success" : "danger"}
      role="status"
      className="empty:hidden"
    >
      {result?.text ?? ""}
    </SignalMessage>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button type="submit" className="btn btn-primary self-start" disabled={busy}>
      {busy ? busyLabel : label}
    </button>
  );
}

export function ChangeNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [fieldError, setFieldError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    setResult(null);
    if (!value) return setFieldError("Enter your name.");
    if (value.length > MAX_NAME_LENGTH) {
      return setFieldError(`Keep your name under ${MAX_NAME_LENGTH} characters.`);
    }
    setFieldError(undefined);
    if (value === name) return setResult({ ok: true, text: "Your name is unchanged." });

    setBusy(true);
    const error = await call(() => authClient.updateUser({ name: value }));
    setBusy(false);
    if (error) return setResult({ ok: false, text: errorText(error, "We couldn't save your name.") });
    setResult({ ok: true, text: "Your name has been updated." });
    router.refresh();
  }

  return (
    <Section id="name-title" title="Name">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={name}
          maxLength={MAX_NAME_LENGTH}
          error={fieldError}
          disabled={busy}
        />
        <SubmitButton busy={busy} label="Save name" busyLabel="Saving…" />
        <Feedback result={result} />
      </form>
    </Section>
  );
}

export function ChangeEmailForm({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [fieldError, setFieldError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = String(new FormData(form).get("email") ?? "").trim().toLowerCase();
    setResult(null);
    if (!EMAIL_PATTERN.test(value)) {
      return setFieldError("Enter a valid email address, like name@example.com.");
    }
    if (value === email.toLowerCase()) return setFieldError("This is already your email address.");
    setFieldError(undefined);

    setBusy(true);
    const error = await call(() =>
      authClient.changeEmail({ newEmail: value, callbackURL: "/account/details?email=changed" }),
    );
    setBusy(false);
    if (error) {
      return setResult({ ok: false, text: errorText(error, "We couldn't start the change.") });
    }
    form.reset();
    // Same reply whether or not the address already has an account, so the
    // form can't be used to find out.
    setResult({
      ok: true,
      text: `If ${value} can be used, we’ve sent a link to it. Your email changes when you open it.`,
    });
  }

  return (
    <Section
      id="email-title"
      title="Email address"
      description={
        <>
          Currently <span className="break-all text-foreground">{email}</span>. We’ll send a link to
          the new address, and the change happens when you open it.
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field
          label="New email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={fieldError}
          disabled={busy}
        />
        <SubmitButton busy={busy} label="Send confirmation link" busyLabel="Sending…" />
        <Feedback result={result} />
      </form>
    </Section>
  );
}

export function ChangePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    setResult(null);

    const nextErrors: typeof errors = {};
    if (!currentPassword) nextErrors.current = "Enter your current password.";
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      nextErrors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (newPassword.length > MAX_PASSWORD_LENGTH) {
      nextErrors.next = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
    }
    setErrors(nextErrors);
    if (nextErrors.current || nextErrors.next) return;

    setBusy(true);
    const error = await call(() =>
      authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }),
    );
    setBusy(false);
    if (error) {
      return setResult({ ok: false, text: errorText(error, "We couldn't change your password.") });
    }
    form.reset();
    setResult({
      ok: true,
      text: "Your password has been changed. Other devices have been signed out.",
    });
  }

  return (
    <Section id="password-title" title="Password">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          error={errors.current}
          disabled={busy}
        />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          error={errors.next}
          disabled={busy}
        />
        <SubmitButton busy={busy} label="Change password" busyLabel="Changing…" />
        <Feedback result={result} />
      </form>
    </Section>
  );
}

export function DeleteAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [fieldError, setFieldError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setResult(null);
    if (!password) return setFieldError("Enter your password to confirm.");
    setFieldError(undefined);

    setBusy(true);
    const error = await call(() => authClient.deleteUser({ password }));
    if (error) {
      setBusy(false);
      return setResult({ ok: false, text: errorText(error, "We couldn't delete your account.") });
    }
    clearWishlistCookie();
    router.replace("/");
    router.refresh();
  }

  return (
    <Section
      id="delete-title"
      title="Delete account"
      description="This removes your account, saved wishlist and sign-in. Orders are kept for our records and can still be found with their reference and email."
    >
      {open ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={fieldError}
            disabled={busy}
            autoFocus
          />
          <div className="flex flex-wrap gap-3">
            <SubmitButton busy={busy} label="Delete my account" busyLabel="Deleting…" />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setResult(null);
                setFieldError(undefined);
              }}
            >
              Cancel
            </button>
          </div>
          <Feedback result={result} />
        </form>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      )}
    </Section>
  );
}
