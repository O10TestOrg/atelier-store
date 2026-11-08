import Link from "next/link";
import { AccountLink } from "@/components/account-link";
import { BagCount } from "@/components/bag-count";
import { MobileMenu } from "@/components/mobile-menu";
import { SearchLink } from "@/components/search-link";
import { WishlistCount, WishlistHeartIcon } from "@/components/wishlist-state";
import {
  BagIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { categoryHref } from "@/lib/catalog";
import { getCategories } from "@/lib/products";

// Built from the categories table (cached, so the header stays in the static
// shell), so every link has a page behind it.
export async function SiteHeader() {
  const categories = await getCategories();
  const navigation = [
    { label: "New in", href: "/collections/new" },
    ...categories.map((category) => ({ label: category.name, href: categoryHref(category.slug) })),
  ];

  return (
    <header className="header-bar">
      <div className="container-page grid h-full grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center">
          {/* Mobile menu: a native disclosure, so it works without client JS. */}
          <MobileMenu className="group lg:hidden">
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
                <AccountLink className="link-quiet self-start">My account</AccountLink>
                <Link href="/wishlist" className="link-quiet self-start">
                  Wishlist
                </Link>
              </div>
            </nav>
          </MobileMenu>

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
          <SearchLink className="btn-icon" aria-label="Search">
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
