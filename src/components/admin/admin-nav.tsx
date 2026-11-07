"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const items = [
  { label: "Overview", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Orders", href: "/admin/orders" },
];

const itemClass = "link-quiet block py-2 lg:py-1.5";

const isCurrent = (pathname: string, href: string) =>
  pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

// Same shape as AccountNav. It's only navigation: every admin page and action
// checks the role itself, so showing these links grants nothing.
export function AdminNav() {
  return (
    <nav
      aria-label="Admin"
      className="-mx-gutter overflow-x-auto border-b px-gutter [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:border-b-0 lg:px-0"
    >
      <ul className="flex gap-6 text-body-sm whitespace-nowrap lg:flex-col lg:gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Suspense
              fallback={
                <Link href={item.href} className={itemClass}>
                  {item.label}
                </Link>
              }
            >
              <NavLink href={item.href}>{item.label}</NavLink>
            </Suspense>
          </li>
        ))}
        <li className="lg:mt-4 lg:border-t lg:pt-4">
          <Link href="/account" className={`${itemClass} text-muted`}>
            My account
          </Link>
        </li>
        <li>
          <Link href="/" className={`${itemClass} text-muted`}>
            View store
          </Link>
        </li>
      </ul>
    </nav>
  );
}

// usePathname suspends under dynamic segments (/admin/orders/[id]), so only
// the active marking waits.
function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={itemClass}
      aria-current={isCurrent(pathname, href) ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
