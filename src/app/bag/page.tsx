import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BagCountSync } from "@/components/bag-count";
import { BagLineControls } from "@/components/bag-line-controls";
import { buildCart, readCart, reconcileCart, type BagLine } from "@/lib/cart";
import { formatPrice, services } from "@/lib/catalog";
import { getCartProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shopping bag",
  robots: { index: false },
};

export default function BagPage() {
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
            Shopping bag
          </li>
        </ol>
      </nav>

      <div className="container-page pb-section">
        <h1 className="pt-2 text-heading lg:pt-6">Shopping bag</h1>
        <Suspense fallback={<BagSkeleton />}>
          <BagContents />
        </Suspense>
      </div>
    </>
  );
}

// Reads the cookie and live prices and stock, so it renders per request.
async function BagContents() {
  const lines = await readCart();
  const products = await getCartProducts(lines.map((line) => line.slug));
  const bag = buildCart(lines, products);
  // What the cookie will hold after the next cart action.
  const syncedCount = reconcileCart(lines, products).reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const countSync = <BagCountSync count={syncedCount} />;

  if (bag.lines.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center border-t py-section text-center">
        {countSync}
        {bag.removedCount > 0 && <RemovedNotice count={bag.removedCount} />}
        <p className="text-heading-sm">Your bag is empty</p>
        <p className="mt-2 max-w-prose text-muted">
          Pieces you add will be kept here for 30 days on this device.
        </p>
        <Link href="/collections/new" className="btn btn-primary mt-8">
          Shop new arrivals
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
      {countSync}
      <section aria-labelledby="bag-items" className="lg:col-span-8">
        <h2 id="bag-items" className="sr-only">
          Items
        </h2>
        {bag.removedCount > 0 && <RemovedNotice count={bag.removedCount} />}
        <ul className="border-t">
          {bag.lines.map((line) => (
            <BagItem key={line.product.slug} line={line} />
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="bag-summary"
        className="lg:col-span-4 lg:self-start lg:sticky lg:top-[calc(var(--header-height)+2rem)]"
      >
        <div className="bg-surface p-6 md:p-8">
          <h2 id="bag-summary" className="text-heading-sm">
            Summary
          </h2>
          <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-3 text-body-sm">
            <dt className="text-muted">
              Subtotal ({bag.itemCount} {bag.itemCount === 1 ? "item" : "items"})
            </dt>
            <dd className="tabular-nums">{formatPrice(bag.subtotal)}</dd>
            <dt className="text-muted">Delivery</dt>
            <dd>Complimentary</dd>
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line-strong pt-4">
            <p>Total</p>
            <p className="text-heading-sm tabular-nums">{formatPrice(bag.subtotal)}</p>
          </div>
          <button type="button" className="btn btn-primary btn-block mt-6" disabled>
            Checkout coming soon
          </button>
          <ul className="mt-6 flex flex-col gap-1 text-meta">
            {services.slice(0, 3).map((service) => (
              <li key={service.title}>{service.title}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function BagItem({ line }: { line: BagLine }) {
  const { product, quantity, maxQuantity, lineTotal, status } = line;
  const href = `/products/${product.slug}`;

  return (
    <li className="flex gap-4 border-b py-6 sm:gap-6">
      <Link
        href={href}
        className={`media-cover aspect-product w-24 shrink-0 sm:w-32 ${status === "unavailable" ? "opacity-50" : ""}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image src={product.image} alt="" fill sizes="8rem" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 className="text-body-sm">
              <Link href={href} className="link-quiet">
                {product.name}
              </Link>
            </h3>
            <p className="mt-1 text-meta">
              {product.colour} · <span className="whitespace-nowrap">Ref. {product.reference}</span>
            </p>
            <p className="mt-1 text-meta tabular-nums">{formatPrice(product.price)} each</p>
          </div>
          {status !== "unavailable" && (
            <p className="text-body-sm tabular-nums sm:text-right">{formatPrice(lineTotal)}</p>
          )}
        </div>

        {status === "reduced" && (
          <p className="mt-3 text-caption text-warning">
            Only {quantity} available, so we’ve reduced the quantity.
          </p>
        )}
        {status === "unavailable" && (
          <p className="mt-3 text-caption text-danger">
            Out of stock. This piece isn’t included in your total.
          </p>
        )}

        <div className="mt-auto pt-4">
          <BagLineControls
            slug={product.slug}
            name={product.name}
            quantity={quantity}
            maxQuantity={maxQuantity}
          />
        </div>
      </div>
    </li>
  );
}

function RemovedNotice({ count }: { count: number }) {
  return (
    <p role="status" className="mb-6 border px-4 py-3 text-body-sm text-muted">
      {count === 1 ? "A piece in your bag is" : `${count} pieces in your bag are`} no
      longer sold and won’t be included.
    </p>
  );
}

function BagSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
      <ul className="border-t lg:col-span-8">
        {Array.from({ length: 2 }, (_, i) => (
          <li key={i} className="flex gap-4 border-b py-6 sm:gap-6">
            <div className="aspect-product w-24 shrink-0 animate-pulse bg-surface sm:w-32" />
            <div className="flex-1">
              <div className="h-4 w-1/2 animate-pulse bg-surface" />
              <div className="mt-2 h-4 w-1/3 animate-pulse bg-surface" />
            </div>
          </li>
        ))}
      </ul>
      <div className="h-72 animate-pulse bg-surface lg:col-span-4" />
    </div>
  );
}
