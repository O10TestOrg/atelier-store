import type { Metadata } from "next";
import Link from "next/link";
import { CLIENT_SERVICES_EMAIL } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Contact client services",
  description: "Email Atelier client services about an order, a piece or your account.",
};

// Every "contact us" link in the store points here, so keep it static and
// dependency-free: it must work when nothing else does.
export default function ContactPage() {
  return (
    <>
      <nav aria-label="Breadcrumb" className="container-page py-4 md:py-6">
        <ol className="flex flex-wrap items-center gap-2 text-caption text-muted">
          <li>
            <Link href="/" className="link-quiet">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Contact
          </li>
        </ol>
      </nav>

      <section className="container-prose pt-6 pb-section md:pt-8">
        <header className="text-center">
          <p className="text-eyebrow text-muted">Client services</p>
          <h1 className="mt-4 text-display">Contact us</h1>
          <p className="mt-4 text-muted">
            Questions about an order, a piece or your account? Email us and we’ll reply.
          </p>
          <a href={`mailto:${CLIENT_SERVICES_EMAIL}`} className="btn btn-primary mt-8">
            Email {CLIENT_SERVICES_EMAIL}
          </a>
        </header>

        <div className="mt-section border-t">
          <section className="border-b py-6" aria-labelledby="orders-title">
            <h2 id="orders-title" className="text-body-sm">
              About an order
            </h2>
            <p className="mt-2 text-body-sm text-muted">
              Include your <strong>order reference</strong> (8 characters, on your confirmation
              and in your account). Checked out as a guest?{" "}
              <Link href="/orders/lookup" className="link text-foreground">
                Find your order
              </Link>{" "}
              with its reference and your email.
            </p>
          </section>
          <section className="border-b py-6" aria-labelledby="pieces-title">
            <h2 id="pieces-title" className="text-body-sm">
              About a piece
            </h2>
            <p className="mt-2 text-body-sm text-muted">
              Include the piece’s <strong>name or Ref.</strong> from its page. Sold out? You
              can ask to be emailed when it’s back.
            </p>
          </section>
          <section className="border-b py-6" aria-labelledby="account-title">
            <h2 id="account-title" className="text-body-sm">
              About your account
            </h2>
            <p className="mt-2 text-body-sm text-muted">
              You can change your name, email address and password in{" "}
              <Link href="/account/details" className="link text-foreground">
                Account details
              </Link>
              . For anything else, write from <strong>your account’s email</strong>.
            </p>
          </section>
        </div>
      </section>
    </>
  );
}
