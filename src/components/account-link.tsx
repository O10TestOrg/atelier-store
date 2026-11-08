"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// The header is static, so it can't know the current page or the session at
// render time. Just before navigating, the link adds where the shopper is as
// `from`: `proxy.ts` hands it to sign-in as `next` for signed-out visitors and
// drops it for everyone else. Reading `location` in a handler (not
// `usePathname`) keeps the header from suspending.
export function AccountLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  const [href, setHref] = useState("/account");

  function capture() {
    const here = location.pathname + location.search;
    setHref(
      here.startsWith("/account") || here === "/sign-in" || here === "/sign-up"
        ? "/account"
        : `/account?from=${encodeURIComponent(here)}`,
    );
  }

  return <Link {...props} href={href} onPointerDown={capture} onFocus={capture} />;
}
