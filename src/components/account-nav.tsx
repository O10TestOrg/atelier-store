"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";

const items = [
  { label: "Overview", href: "/account" },
  { label: "Orders", href: "/account/orders" },
  { label: "Account details", href: "/account/details" },
];

const itemClass = "link-quiet block py-2 lg:py-1.5";

// Horizontal, scrollable tabs on small screens; a sidebar list from lg up.
// `extra` holds items that depend on the session (e.g. the admin link).
export function AccountNav({ extra }: { extra?: ReactNode }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account"
      className="-mx-gutter overflow-x-auto border-b px-gutter [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:border-b-0 lg:px-0"
    >
      <ul className="flex gap-6 text-body-sm whitespace-nowrap lg:flex-col lg:gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={itemClass}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
        {extra}
        <li className="lg:mt-4 lg:border-t lg:pt-4">
          <SignOutButton className="link-quiet block cursor-pointer py-2 text-muted disabled:cursor-progress lg:py-1.5" />
        </li>
      </ul>
    </nav>
  );
}

export function AccountNavItem({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={itemClass}>
        {children}
      </Link>
    </li>
  );
}
