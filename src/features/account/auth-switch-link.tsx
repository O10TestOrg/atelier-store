"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { safeRedirectPath } from "@/lib/redirect";

const className = "link text-foreground";

// Links between sign-in and sign-up, keeping where the visitor was headed.
// Render inside <Suspense fallback={<AuthSwitchLinkFallback … />}>.
export function AuthSwitchLink({ href, children }: { href: string; children: ReactNode }) {
  const next = safeRedirectPath(useSearchParams().get("next"), "");
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className={className}>
      {children}
    </Link>
  );
}

export function AuthSwitchLinkFallback({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
