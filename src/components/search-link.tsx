"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

// The header's search icon asks the search page to focus its input. A flag in
// module state rather than `autoFocus`, so focus moves only after this click,
// not on every visit to /search. A full-page load starts with it unset.
let focusRequested = false;

export function consumeSearchFocus() {
  const requested = focusRequested;
  focusRequested = false;
  return requested;
}

export function SearchLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      {...props}
      href="/search"
      onClick={(event) => {
        // Modified clicks open a new tab, which doesn't share this module.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // Already on /search, the form won't remount to read the flag.
        if (location.pathname === "/search") {
          document.getElementById("search-query")?.focus();
        } else {
          focusRequested = true;
        }
      }}
    />
  );
}
