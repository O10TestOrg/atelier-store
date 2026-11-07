import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section container-prose flex flex-col items-center text-center">
      <p className="text-eyebrow text-muted">404</p>
      <h1 className="mt-4 text-heading">This page could not be found</h1>
      <p className="mt-4 text-muted">
        The piece you are looking for may have moved or is no longer available.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Return to the homepage
      </Link>
    </section>
  );
}
