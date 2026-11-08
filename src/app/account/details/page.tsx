import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Account details",
  robots: { index: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export default function AccountDetailsPage() {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">My account</p>
        <h1 className="mt-4 text-heading">Account details</h1>
      </header>

      <Suspense fallback={<DetailsFallback />}>
        <Details />
      </Suspense>

      <p className="mt-8 max-w-prose text-body-sm text-muted">
        To change your name or email address, please{" "}
        <Link href="/help/contact" className="link text-foreground">
          contact client services
        </Link>
        .
      </p>
    </>
  );
}

const rows = ["Name", "Email", "Member since"] as const;

async function Details() {
  const user = await requireUser("/account/details");
  const values: Record<(typeof rows)[number], string> = {
    Name: user.name,
    Email: user.email,
    "Member since": dateFormat.format(user.createdAt),
  };

  return (
    <dl className="mt-10 border-t">
      {rows.map((label) => (
        <div key={label} className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6">
          <dt className="text-meta sm:w-40 sm:shrink-0">{label}</dt>
          <dd className="break-all">{values[label]}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailsFallback() {
  return (
    <dl className="mt-10 border-t" aria-busy="true">
      {rows.map((label) => (
        <div key={label} className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6">
          <dt className="text-meta sm:w-40 sm:shrink-0">{label}</dt>
          <dd className="h-6 w-48 max-w-full animate-pulse bg-surface" />
        </div>
      ))}
    </dl>
  );
}
