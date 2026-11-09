import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ChangeEmailForm,
  ChangeNameForm,
  ChangePasswordForm,
  DeleteAccountForm,
} from "@/features/account/account-details-forms";
import { EmailVerificationNotice } from "@/features/account/email-verification-notice";
import { Notice } from "@/components/signal";
import { formatMonthYear } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Account details",
  robots: { index: false },
};

export default function AccountDetailsPage({ searchParams }: PageProps<"/account/details">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">My account</p>
        <h1 className="mt-4 text-heading">Account details</h1>
      </header>

      <Suspense fallback={<DetailsFallback />}>
        <Details searchParams={searchParams} />
      </Suspense>

      <p className="mt-8 max-w-prose text-body-sm text-muted">
        Need help with your account?{" "}
        <Link href="/help/contact" className="link text-foreground">
          Contact client services
        </Link>
        .
      </p>
    </>
  );
}

async function Details({ searchParams }: Pick<PageProps<"/account/details">, "searchParams">) {
  const user = await requireUser("/account/details");
  // Set by the link that confirms a new email address.
  const emailChanged = (await searchParams).email === "changed";

  return (
    <>
      {emailChanged && (
        <Notice tone="success" role="status" className="mt-8">
          Your email address is now {user.email}.
        </Notice>
      )}
      <EmailVerificationNotice returnTo="/account/details" />
      <p className="mt-8 text-meta">Member since {formatMonthYear(user.createdAt)}</p>
      <div className="mt-2 border-t">
        <ChangeNameForm name={user.name} />
        <ChangeEmailForm email={user.email} />
        <ChangePasswordForm />
        {user.role !== "admin" && <DeleteAccountForm />}
      </div>
    </>
  );
}

function DetailsFallback() {
  return (
    <div className="mt-10 flex flex-col gap-8 border-t pt-8" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex max-w-md flex-col gap-3">
          <div className="h-6 w-32 animate-pulse bg-surface" />
          <div className="h-12 animate-pulse bg-surface" />
        </div>
      ))}
    </div>
  );
}
