"use client";

import Link from "next/link";
import { useEffect } from "react";

// Catches errors in any page below the root layout (a database or Stripe call
// failing mid-render), so the header and footer stay and the shopper has a way
// back. Server error messages are replaced by a digest in production.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <section className="section container-prose flex flex-col items-center text-center">
      <p className="text-eyebrow text-muted">Something went wrong</p>
      <h1 className="mt-4 text-heading">We couldn’t load this page</h1>
      <p className="mt-4 text-muted">
        This is usually temporary. Your bag and any order you’ve placed are safe.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Return to the homepage
        </Link>
      </div>
      {digest && <p className="mt-6 text-meta">Reference {digest}</p>}
    </section>
  );
}
