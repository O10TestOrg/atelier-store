import Link from "next/link";
import { BagCount } from "@/components/bag-count";
import {
  BagIcon,
  CloseIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";

const navigation = [
  { label: "Women", href: "/women" },
  { label: "Men", href: "/men" },
  { label: "Leather Goods", href: "/collections/leather-goods" },
  { label: "Shoes", href: "/collections/shoes" },
  { label: "Jewelry", href: "/collections/jewelry" },
];

export function SiteHeader() {
  return (
    <header className="header-bar">
      <div className="container-page grid h-full grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center">
          {/* Mobile menu: a native disclosure, so it works without client JS. */}
          <details className="group lg:hidden">
            <summary
              className="btn-icon -ml-3 list-none [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <MenuIcon className="group-open:hidden" />
              <CloseIcon className="hidden group-open:block" />
            </summary>
            <nav
              aria-label="Main"
              className="absolute inset-x-0 top-full h-[calc(100svh-var(--header-height))] overflow-y-auto border-t bg-background"
            >
              <ul className="container-page py-6">
                {navigation.map((item) => (
                  <li key={item.href} className="border-b">
                    <Link href={item.href} className="block py-4 text-heading-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="container-page flex flex-col gap-3 pb-8 text-body-sm">
                <Link href="/account" className="link-quiet self-start">
                  My account
                </Link>
                <Link href="/wishlist" className="link-quiet self-start">
                  Wishlist
                </Link>
              </div>
            </nav>
          </details>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex gap-6 text-body-sm">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="link-quiet">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link
          href="/"
          className="text-heading-sm tracking-[0.35em] uppercase"
          aria-label="Atelier home"
        >
          Atelier
        </Link>

        <div className="-mr-3 flex items-center justify-end">
          <Link href="/search" className="btn-icon" aria-label="Search">
            <SearchIcon />
          </Link>
          <Link
            href="/account"
            className="btn-icon hidden sm:inline-flex"
            aria-label="Account"
          >
            <UserIcon />
          </Link>
          <Link
            href="/wishlist"
            className="btn-icon hidden sm:inline-flex"
            aria-label="Wishlist"
          >
            <HeartIcon />
          </Link>
          <Link href="/bag" className="btn-icon relative">
            <BagIcon />
            <BagCount />
          </Link>
        </div>
      </div>
    </header>
  );
}
