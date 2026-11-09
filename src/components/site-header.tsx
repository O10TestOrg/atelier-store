import Link from "next/link";
import { AccountLink } from "@/components/account-link";
import { BagCount } from "@/components/bag-count";
import { HeaderMenu } from "@/components/header-menu";
import { SearchLink } from "@/components/search-link";
import { WishlistCount, WishlistHeartIcon } from "@/components/wishlist-state";
import {
  BagIcon,
  ChevronDownIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { categoryHref } from "@/lib/catalog";
import { getCategories } from "@/lib/products";

// "New in" is set apart as a pill so it reads as the season's entry point.
const newInPill =
  "inline-flex items-center rounded-pill bg-inverse px-3 py-1 text-caption tracking-eyebrow text-on-inverse uppercase";

// Built from the categories table (cached, so the header stays in the static
// shell), so every link has a page behind it.
export async function SiteHeader() {
  const categories = await getCategories();
  const collections = [
    { label: "Shop all", href: "/search" },
    ...categories.map((category) => ({ label: category.name, href: categoryHref(category.slug) })),
  ];

  return (
    <header className="header-bar">
      <div className="container-page grid h-full grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center">
          {/* Mobile menu: a native disclosure, so it works without client JS. */}
          <HeaderMenu className="group lg:hidden">
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
                <li className="border-b">
                  <Link
                    href="/collections/new"
                    className="flex items-center justify-between gap-4 py-4 text-heading-sm"
                  >
                    New in
                    <span className={newInPill}>Just in</span>
                  </Link>
                </li>
                {collections.map((item) => (
                  <li key={item.href} className="border-b">
                    <Link href={item.href} className="block py-4 text-heading-sm">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="container-page flex flex-col gap-3 pb-8 text-body-sm">
                <AccountLink className="link-quiet self-start">My account</AccountLink>
                <Link href="/wishlist" className="link-quiet self-start">
                  Wishlist
                </Link>
              </div>
            </nav>
          </HeaderMenu>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-6 text-body-sm">
              <li>
                <Link href="/collections/new" className={`${newInPill} transition-opacity hover:opacity-80`}>
                  New in
                </Link>
              </li>
              <li>
                <HeaderMenu className="group/collections relative">
                  <summary className="link-quiet flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                    Collections
                    <ChevronDownIcon
                      width={16}
                      height={16}
                      className="transition-transform group-open/collections:rotate-180"
                    />
                  </summary>
                  {/* Drops from the header's bottom edge: (header height - line height) / 2. */}
                  <ul className="absolute top-full left-0 mt-[calc((var(--header-height)-1.25rem)/2)] min-w-56 border bg-background py-2">
                    {collections.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="link-quiet block px-5 py-2.5">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </HeaderMenu>
              </li>
              <li>
                <SearchLink className="link-quiet flex items-center gap-2">
                  <SearchIcon width={18} height={18} />
                  Search
                </SearchLink>
              </li>
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
          <SearchLink className="btn-icon lg:hidden" aria-label="Search">
            <SearchIcon />
          </SearchLink>
          <AccountLink className="btn-icon hidden sm:inline-flex" aria-label="Account">
            <UserIcon />
          </AccountLink>
          <Link href="/wishlist" className="btn-icon relative hidden sm:inline-flex">
            <WishlistHeartIcon />
            <WishlistCount />
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
