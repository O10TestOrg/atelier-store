"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import {
  isValidEmail,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/account-fields";
import { authClient } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/redirect";
import { Notice, SignalMessage } from "@/components/signal";

type Mode = "sign-in" | "sign-up";
type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, ReactNode>>;
type FormError = { message: string; focus: boolean };


const fieldsFor: Record<Mode, FieldName[]> = {
  "sign-in": ["email", "password"],
  "sign-up": ["name", "email", "password"],
};

const labels = {
  "sign-in": ["Sign in", "Signing in…"],
  "sign-up": ["Create account", "Creating account…"],
} as const;

// Calls Better Auth's HTTP endpoints (not `auth.api` from a Server Action) so
// sign-in and sign-up go through its rate limiter and origin checks.
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startTransition] = useTransition();
  const busy = submitting || navigating;

  // Errors only appear after the first submit, then update as the user types.
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLength, setPasswordLength] = useState(0);

  const inputs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Prefill from "Sign in instead" links. Read on mount so the page stays static.
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (email && inputs.current.email) inputs.current.email.value = email;
  }, []);

  useEffect(() => {
    if (formError?.focus) alertRef.current?.focus();
  }, [formError]);

  function revalidate(name: FieldName, value: string) {
    if (name === "password") setPasswordLength(value.length);
    setFormError(null);
    if (!submitted) return;
    setErrors((current) => ({ ...current, [name]: validate(mode, name, value) }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const values = Object.fromEntries(
      fieldsFor[mode].map((name) => [name, inputs.current[name]?.value ?? ""]),
    ) as Record<FieldName, string>;

    const nextErrors: FieldErrors = {};
    for (const name of fieldsFor[mode]) {
      const error = validate(mode, name, values[name]);
      if (error) nextErrors[name] = error;
    }

    setSubmitted(true);
    setErrors(nextErrors);
    setFormError(null);

    const firstInvalid = fieldsFor[mode].find((name) => nextErrors[name]);
    if (firstInvalid) {
      inputs.current[firstInvalid]?.focus();
      return;
    }

    setSubmitting(true);
    const email = values.email.trim();
    const { password } = values;

    let error: { status: number; code?: string } | null;
    try {
      ({ error } =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password, rememberMe: true })
          : await authClient.signUp.email({
              name: values.name.trim(),
              email,
              password,
              // Where the emailed confirmation link lands (see EmailVerificationNotice).
              callbackURL: "/account?verified=1",
            }));
    } catch {
      error = { status: 0 };
    }

    if (!error) {
      const next = new URLSearchParams(window.location.search).get("next");
      // The transition keeps the button busy until the next page has rendered.
      startTransition(() => {
        router.replace(safeRedirectPath(next));
        // Drops the client router cache, so pages seen while signed out aren't reused.
        router.refresh();
      });
      return;
    }

    setSubmitting(false);
    handleServerError(error, email);
  }

  function handleServerError(error: { status: number; code?: string }, email: string) {
    if (error.status === 429) {
      setFormError({
        message: "Too many attempts. Please wait a minute and try again.",
        focus: true,
      });
      return;
    }
    if (error.status === 0 || error.status >= 500) {
      setFormError({
        message: "We couldn't reach Atelier. Check your connection and try again.",
        focus: true,
      });
      return;
    }

    if (mode === "sign-in") {
      // Deliberately vague, so the form doesn't reveal which emails have accounts.
      setFormError({ message: "Email or password is incorrect.", focus: false });
      const password = inputs.current.password;
      if (password) {
        password.value = "";
        setPasswordLength(0);
        password.focus();
      }
      return;
    }

    const fieldError = signUpFieldError(error.code, email);
    if (fieldError) {
      setErrors({ [fieldError.field]: fieldError.message });
      inputs.current[fieldError.field]?.focus();
      return;
    }
    setFormError({
      message: "We couldn't create your account. Please try again.",
      focus: true,
    });
  }

  const passwordHint =
    mode === "sign-up"
      ? passwordLength >= MIN_PASSWORD_LENGTH
        ? `✓ At least ${MIN_PASSWORD_LENGTH} characters`
        : `At least ${MIN_PASSWORD_LENGTH} characters`
      : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={busy} className="flex flex-col gap-6">
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        {mode === "sign-up" && (
          <Field
            label="Name"
            error={errors.name}
            ref={(el) => {
              inputs.current.name = el;
            }}
            name="name"
            type="text"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => revalidate("name", e.target.value)}
            onBlur={(e) => revalidate("name", e.target.value)}
          />
        )}

        <Field
          label="Email"
          error={errors.email}
          ref={(el) => {
            inputs.current.email = el;
          }}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => revalidate("email", e.target.value)}
          onBlur={(e) => revalidate("email", e.target.value)}
        />

        <Field
          label="Password"
          error={errors.password}
          hint={passwordHint}
          ref={(el) => {
            inputs.current.password = el;
          }}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          autoCapitalize="none"
          spellCheck={false}
          className="pr-14"
          onChange={(e) => revalidate("password", e.target.value)}
          onBlur={(e) => revalidate("password", e.target.value)}
          trailing={
            <button
              type="button"
              className="btn-icon absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
        />
      </fieldset>

      {formError && (
        <Notice ref={alertRef} tone="danger" role="alert" tabIndex={-1} className="outline-none">
          {formError.message}
        </Notice>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border border-current border-t-transparent"
          />
        )}
        {labels[mode][busy ? 1 : 0]}
      </button>
    </form>
  );
}

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: ReactNode;
  hint?: string;
  trailing?: ReactNode;
};

export function Field({ label, error, hint, trailing, className = "", ...inputProps }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="text-body-sm">
      <label htmlFor={id}>{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`block h-12 w-full border bg-background px-4 text-body outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong disabled:bg-surface disabled:text-muted aria-invalid:border-danger ${className}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {error && (
        <SignalMessage id={errorId} tone="danger" size="caption" className="mt-2">
          {error}
        </SignalMessage>
      )}
      {hint && (
        <p id={hintId} className="mt-2 text-caption text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function validate(mode: Mode, name: FieldName, value: string): string | undefined {
  switch (name) {
    case "name": {
      const name = value.trim();
      if (!name) return "Enter your name.";
      if (name.length > MAX_NAME_LENGTH) {
        return `Keep your name under ${MAX_NAME_LENGTH} characters.`;
      }
      return;
    }
    case "email": {
      const email = value.trim();
      if (!email) return "Enter your email address.";
      if (!isValidEmail(email)) {
        return "Enter a valid email address, like name@example.com.";
      }
      return;
    }
    case "password":
      if (!value) return "Enter your password.";
      if (mode === "sign-in") return;
      if (value.length < MIN_PASSWORD_LENGTH) {
        return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (value.length > MAX_PASSWORD_LENGTH) {
        return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
      }
  }
}

// Server-side rules backstop the client ones; map them onto the matching field.
function signUpFieldError(
  code: string | undefined,
  email: string,
): { field: FieldName; message: ReactNode } | null {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": {
      const params = new URLSearchParams({ email });
      const next = new URLSearchParams(window.location.search).get("next");
      if (next) params.set("next", safeRedirectPath(next));
      return {
        field: "email",
        message: (
          <>
            An account with this email already exists.{" "}
            <Link href={`/sign-in?${params}`} className="link">
              Sign in instead
            </Link>
          </>
        ),
      };
    }
    case "INVALID_EMAIL":
      return { field: "email", message: "Enter a valid email address, like name@example.com." };
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
    case "PASSWORD_TOO_LONG":
      return { field: "password", message: `Use ${MAX_PASSWORD_LENGTH} characters or fewer.` };
    default:
      return null;
  }
}
