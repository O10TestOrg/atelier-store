"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, type ReactNode } from "react";

// The header lives in the root layout, so it survives client-side navigation
// and a native <details> would stay open over the next page. This keeps the
// no-JS disclosure (the mobile menu and the Collections dropdown) but closes
// it on a link tap, on Escape, on a click outside it and whenever the path
// changes (Back and Forward included).
export function HeaderMenu({ className, children }: { className?: string; children: ReactNode }) {
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
    function onPointerDown(event: PointerEvent) {
      const menu = ref.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
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
