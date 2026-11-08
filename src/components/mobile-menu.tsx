"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, type ReactNode } from "react";

// The header lives in the root layout, so it survives client-side navigation
// and a native <details> would stay open over the next page. This keeps the
// no-JS disclosure but closes it on a link tap, on Escape and whenever the
// path changes (Back and Forward included).
export function MobileMenu({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useCallback(() => {
    if (ref.current) ref.current.open = false;
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(event) => {
        if ((event.target as Element).closest("a")) close();
      }}
    >
      {children}
      {/* `usePathname` suspends under dynamic segments, so only this reads it. */}
      <Suspense>
        <CloseOnNavigation onNavigate={close} />
      </Suspense>
    </details>
  );
}

function CloseOnNavigation({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(onNavigate, [onNavigate, pathname]);
  return null;
}
