import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ANNOUNCER_ID, PAGE_HEADING_ID } from "@/components/focus-after-removal";
import { ProductCard } from "@/components/product-card";
import { ClearWishlistButton, WishlistItemControls } from "@/components/wishlist-item-controls";
import { WishlistSync } from "@/components/wishlist-state";
import { getStockState } from "@/lib/catalog";
import { getCartProducts, type Product } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import { getUserWishlistSlugs, readWishlistCookie } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false },
};

export default function WishlistPage() {
  return (
    <>
      <nav aria-label="Breadcrumb" className="container-page py-4 md:py-6">
        <ol className="flex flex-wrap items-center gap-2 text-caption text-muted">
          <li>
            <Link href="/" className="link-quiet">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Wishlist
          </li>
        </ol>
      </nav>

      <div className="container-page pb-section">
        <h1 id={PAGE_HEADING_ID} tabIndex={-1} className="pt-2 text-heading lg:pt-6">
          Wishlist
        </h1>
        <p id={ANNOUNCER_ID} role="status" className="sr-only" />
        <Suspense fallback={<WishlistSkeleton />}>
          <WishlistContents />
        </Suspense>
      </div>
    </>
  );
}

// Reads the session or cookie and live stock, so it renders per request.
async function WishlistContents() {
  const user = await getCurrentUser();
  const slugs = user ? await getUserWishlistSlugs(user.id) : await readWishlistCookie();
  const bySlug = new Map(
    (await getCartProducts(slugs)).map((product) => [product.slug, product]),
  );
  // Saved order, without pieces that are no longer sold.
  const products = slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  const sync = <WishlistSync slugs={products.map((product) => product.slug)} />;
  const nudge = !user && <SignInNudge />;

  if (products.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center border-t py-section text-center">
        {sync}
        <p className="text-heading-sm">Your wishlist is empty</p>
        <p className="mt-2 max-w-prose text-muted">
          Tap the heart on any piece to save it here.
        </p>
        <Link href="/collections/new" className="btn btn-primary mt-8">
          Shop new arrivals
        </Link>
        {nudge}
      </div>
    );
  }

  return (
    <div className="mt-8">
      {sync}
      {nudge}
      <div className="mb-6 flex items-end justify-between gap-4 border-t pt-4">
        <p className="text-meta">
          {products.length} {products.length === 1 ? "piece" : "pieces"}
        </p>
        <ClearWishlistButton />
      </div>
      <h2 className="sr-only">Saved pieces</h2>
      <ul className="grid-products">
        {products.map((product) => (
          <WishlistItem key={product.slug} product={product} />
        ))}
      </ul>
    </div>
  );
}

function WishlistItem({ product }: { product: Product }) {
  return (
    <li>
      <ProductCard product={product} />
      <WishlistItemControls
        slug={product.slug}
        name={product.name}
        isSoldOut={getStockState(product) === "out-of-stock"}
      />
    </li>
  );
}

function SignInNudge() {
  return (
    <p className="mt-8 mb-6 border px-4 py-3 text-body-sm text-muted">
      <Link href="/sign-in?next=/wishlist" className="link text-foreground">
        Sign in
      </Link>{" "}
      to keep your wishlist across devices.
    </p>
  );
}

function WishlistSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8 border-t pt-14">
      <div className="grid-products">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <div className="aspect-product animate-pulse bg-surface" />
            <div className="mt-3 h-4 w-1/2 animate-pulse bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
