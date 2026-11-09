import { Notice } from "@/components/signal";
import { ResendVerificationButton } from "@/features/account/resend-verification-button";
import { requireUser } from "@/lib/session";

// The soft-verification nudge (see `emailVerification` in src/lib/auth.ts).
// Verification links come back to `/account?verified=1`, with `error` added
// when the link was expired or invalid. Render inside <Suspense>.
export async function EmailVerificationNotice({
  returnTo,
  searchParams,
}: {
  returnTo: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(returnTo);
  const params = (await searchParams) ?? {};

  if (user.emailVerified) {
    if (params.verified !== "1" || params.error) return null;
    return (
      <Notice tone="success" role="status" className="mt-8">
        Thank you, your email address is confirmed. Orders you placed as a guest with it are now
        in your account.
      </Notice>
    );
  }

  return (
    <Notice tone={params.error ? "danger" : "warning"} className="mt-8">
      <p>
        {params.error
          ? "That confirmation link has expired or was already used."
          : `Please confirm your email address. We sent a link to ${user.email}.`}
      </p>
      <p className="mt-1 text-muted">
        Confirming lets us reach you about your orders and adds orders you placed as a guest to
        your account.
      </p>
      <ResendVerificationButton email={user.email} />
    </Notice>
  );
}
