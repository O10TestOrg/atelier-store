"use client";

import { Geist } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Replaces the root layout when it fails (the header itself, say), so it
// brings its own document and styles. Plain links: the router may be what broke.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <title>Something went wrong | Atelier</title>
        <main className="section container-prose flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-body-sm tracking-[0.35em] uppercase">Atelier</p>
          <h1 className="mt-8 text-heading">We couldn’t load this page</h1>
          <p className="mt-4 text-muted">
            This is usually temporary. Your bag and any order you’ve placed are safe.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => retry()} className="btn btn-primary">
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="btn btn-secondary">
              Return to the homepage
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
