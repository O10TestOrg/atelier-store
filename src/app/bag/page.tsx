import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BagCountSync } from "@/components/bag-count";
import { ClearCheckoutParams, SettleCheckout } from "@/components/bag-checkout";
import { BagLineControls } from "@/components/bag-line-controls";
import { CheckoutButton } from "@/components/checkout-button";
import { DeliveryCountrySelect } from "@/components/delivery-country-select";
import { ANNOUNCER_ID, PAGE_HEADING_ID } from "@/components/focus-after-removal";
import { buildCart, creditHeldStock, readCart, reconcileCart, type BagLine } from "@/lib/cart";
import { formatPrice, services } from "@/lib/catalog";
import { orderReference } from "@/lib/orders";
import { readBrowserCheckout, type BrowserCheckout } from "@/lib/pending-checkout";
import { getCartProducts } from "@/lib/products";
import { COUNTRIES, formatDays, ratesFor, readDeliveryCountry } from "@/lib/shipping";
import { Notice, SignalMessage } from "@/components/signal";

export const metadata: Metadata = {
  title: "Shopping bag",
  robots: { index: false },
};

export default function BagPage({ searchParams }: PageProps<"/bag">) {
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
        <h1 id={PAGE_HEADING_ID} tabIndex={-1} className="pt-2 text-heading lg:pt-6">
          Shopping bag
        </h1>
        <p id={ANNOUNCER_ID} role="status" className="sr-only" />
        <Suspense fallback={<BagSkeleton />}>
          <CheckoutNotice searchParams={searchParams} />
          <BagContents />
        </Suspense>
      </div>
    </>
  );
}

// Reads the cookie and live prices and stock, so it renders per request.
// Stock this browser's own open checkout holds counts as available here, so
// pressing Back from Stripe doesn't show the shopper's pieces as sold out.
async function BagContents() {
  const [lines, checkout, country] = await Promise.all([
    readCart(),
    readBrowserCheckout(),
    readDeliveryCountry(),
  ]);
  const [delivery, ...upgrades] = ratesFor(country);
  const live = await getCartProducts(lines.map((line) => line.slug));
  const products = creditHeldStock(live, checkout?.state === "holding" ? checkout.held : []);
  const bag = buildCart(lines, products);
  // What the cookie will hold after the next cart action.
  const syncedCount = reconcileCart(lines, products).reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const bagStatus = (
    <>
      <BagCountSync count={syncedCount} />
      <OpenCheckoutNotice checkout={checkout} />
    </>
  );

  if (bag.lines.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center border-t py-section text-center">
        {bagStatus}
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
      {bagStatus}
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
          <div className="mt-6 text-body-sm">
            <DeliveryCountrySelect
              countries={COUNTRIES.map(({ code, name }) => ({ code, name }))}
              current={country.code}
            />
          </div>
          <dl className="mt-6 grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-body-sm">
            <dt className="text-muted">
              Subtotal ({bag.itemCount} {bag.itemCount === 1 ? "item" : "items"})
            </dt>
            <dd className="text-right tabular-nums">{formatPrice(bag.subtotal)}</dd>
            <dt className="text-muted">
              {delivery.name}
              <span className="block text-meta">{formatDays(delivery)}</span>
            </dt>
            <dd className="text-right tabular-nums">
              {delivery.amount === 0 ? "Complimentary" : formatPrice(delivery.amount)}
            </dd>
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line-strong pt-4">
            <p>Total</p>
            <p className="text-heading-sm tabular-nums">
              {formatPrice(bag.subtotal + (bag.subtotal > 0 ? delivery.amount : 0))}
            </p>
          </div>
          <ul className="mt-3 flex flex-col gap-1 text-meta">
            {upgrades.map((rate) => (
              <li key={rate.name}>
                {rate.name} delivery available at checkout for {formatPrice(rate.amount)}.
              </li>
            ))}
            {country.zone === "uk" ? (
              <li>Prices include VAT.</li>
            ) : (
              <li>
                Orders to {country.name} may be charged import duties and taxes on delivery.
                These are payable by the recipient.
              </li>
            )}
          </ul>
          <CheckoutButton expectedTotal={bag.subtotal} expectedCountry={country.code} />
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
          <SignalMessage tone="warning" size="caption" className="mt-3">
            Only {quantity} available, so we’ve reduced the quantity.
          </SignalMessage>
        )}
        {status === "unavailable" && (
          <SignalMessage tone="danger" size="caption" className="mt-3">
            Out of stock. This piece isn’t included in your total.
          </SignalMessage>
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

// What this browser's last checkout is doing. Holding: the shopper went Back
// from Stripe, and checking out again releases that hold first. Placed: they
// paid but never came back through /checkout/return, so settle it now.
function OpenCheckoutNotice({ checkout }: { checkout: BrowserCheckout }) {
  if (checkout?.state === "holding") {
    return (
      <Notice tone="info" role="status" className="mb-6 lg:col-span-12">
        Your checkout is still open, so we’re holding its pieces for you. Checking out
        again starts a new one.
      </Notice>
    );
  }
  if (checkout?.state === "placed") {
    return (
      <Notice tone="success" role="status" className="mb-6 lg:col-span-12">
        <SettleCheckout />
        Order {orderReference(checkout.order)} has been placed. Updating your bag…
      </Notice>
    );
  }
  return null;
}

const SESSION_ID = /^cs_[A-Za-z0-9_]{1,250}$/;

// One-off messages after a round trip to Stripe, from /checkout/cancel,
// /checkout/return or `settleCheckout`. The stock and bag are already settled.
async function CheckoutNotice({ searchParams }: Pick<PageProps<"/bag">, "searchParams">) {
  const { checkout, session_id: sessionId } = await searchParams;
  const notice =
    checkout === "canceled"
      ? { tone: "info" as const, message: "Checkout was cancelled. Your bag is just as you left it." }
      : checkout === "expired"
        ? { tone: "warning" as const, message: "Your checkout session timed out. Please check out again." }
        : checkout === "placed"
          ? { tone: "success" as const, message: "Your order has been placed, and its pieces have left your bag." }
          : null;
  if (!notice) return null;
  return (
    <Notice tone={notice.tone} role="status" className="mt-8">
      <ClearCheckoutParams />
      {notice.message}
      {checkout === "placed" && typeof sessionId === "string" && SESSION_ID.test(sessionId) && (
        <>
          {" "}
          <Link href={`/checkout/success?session_id=${sessionId}`} className="link">
            View order
          </Link>
        </>
      )}
    </Notice>
  );
}

function RemovedNotice({ count }: { count: number }) {
  return (
    <Notice tone="warning" role="status" className="mb-6">
      {count === 1 ? "A piece in your bag is" : `${count} pieces in your bag are`} no
      longer sold and won’t be included.
    </Notice>
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
