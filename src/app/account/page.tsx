import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmailVerificationNotice } from "@/components/email-verification-notice";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Overview</p>
        <Suspense fallback={<h1 className="mt-4 text-heading">Welcome back</h1>}>
          <Greeting />
        </Suspense>
        <p className="mt-4 max-w-prose text-muted">
          Manage your details, review your orders and find your way back to the collection.
        </p>
      </header>

      <Suspense>
        <EmailVerificationNotice returnTo="/account" searchParams={searchParams} />
      </Suspense>

      <ul className="mt-10 grid gap-px border bg-line sm:grid-cols-2">
        <Tile
          href="/account/orders"
          title="Orders"
          description="Pieces you’ve ordered and their totals."
        />
        <Tile
          href="/account/details"
          title="Account details"
          description="Your name, email address and password."
        />
        <Tile
          href="/collections/new"
          title="New arrivals"
          description="The latest pieces from the atelier."
        />
        <Tile
          href="/search"
          title="Search the collection"
          description="Find a piece by name, colour or material."
        />
        <Tile
          href="/help/contact"
          title="Client services"
          description="Questions about an order, repairs or care."
        />
      </ul>
    </>
  );
}

async function Greeting() {
  const user = await requireUser("/account");
  const firstName = user.name.split(" ")[0];
  return <h1 className="mt-4 text-heading">Welcome back, {firstName}</h1>;
}

function Tile({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <li className="bg-background">
      <Link
        href={href}
        className="group flex h-full flex-col p-6 transition-colors hover:bg-surface md:p-8"
      >
        <h2 className="text-body-sm">
          {title} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </h2>
        <p className="mt-2 text-meta">{description}</p>
      </Link>
    </li>
  );
}
