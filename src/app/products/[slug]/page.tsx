import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AddToBagButton } from "@/components/add-to-bag-button";
import { PlusIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { StockStatus } from "@/components/stock-status";
import { WishlistButton } from "@/components/wishlist-button";
import {
  categoryHref,
  formatPrice,
  getStockState,
  services,
} from "@/lib/catalog";
import {
  getProduct,
  getProductSlugs,
  getRelatedProducts,
  type Product,
} from "@/lib/products";

// Render unlisted slugs fully before responding, so notFound() sends a real
// 404 instead of a 200 from the streamed fallback shell.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return getProductSlugs();
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description,
    openGraph: { images: [{ url: product.image, alt: product.imageAlt }] },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(
    product.slug,
    product.category.slug,
  );
  const isSoldOut = getStockState(product) === "out-of-stock";

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
          <li>
            <Link href={categoryHref(product.category.slug)} className="link-quiet">
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="container-page grid gap-8 pb-section lg:grid-cols-12 lg:gap-12">
        <Gallery product={product} />

        <div className="lg:col-span-5 lg:self-start lg:sticky lg:top-[calc(var(--header-height)+2rem)] xl:pr-8">
          <p className="text-caption text-muted">Ref. {product.reference}</p>
          <h1 className="mt-2 text-heading">{product.name}</h1>
          <p className="mt-3 text-heading-sm tabular-nums">
            {formatPrice(product.price)}
          </p>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-6 text-body-sm">
            <dt className="text-muted">Category</dt>
            <dd>
              <Link href={categoryHref(product.category.slug)} className="link-quiet">
                {product.category.name}
              </Link>
            </dd>
            <dt className="text-muted">Colour</dt>
            <dd>{product.colour}</dd>
            <dt className="text-muted">Availability</dt>
            <dd>
              <StockStatus product={product} />
            </dd>
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            {isSoldOut ? (
              <>
                <button type="button" className="btn btn-primary btn-block" disabled>
                  Out of stock
                </button>
                <WishlistButton slug={product.slug} name={product.name} variant="block" />
                <Link href="/help/contact" className="btn btn-secondary btn-block">
                  Contact an advisor
                </Link>
              </>
            ) : (
              <>
                <AddToBagButton slug={product.slug} />
                <WishlistButton slug={product.slug} name={product.name} variant="block" />
              </>
            )}
          </div>

          <ul className="mt-6 flex flex-col gap-1 text-meta">
            {services.slice(0, 2).map((service) => (
              <li key={service.title}>{service.title}</li>
            ))}
          </ul>

          <p className="mt-8 text-body-sm leading-6">{product.description}</p>

          <div className="mt-8 border-t">
            <Disclosure title="Product details" defaultOpen>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </Disclosure>
            <Disclosure title="Delivery & returns">
              <p>
                Complimentary express delivery in 2–4 business days, signed for
                on arrival. Unworn pieces can be returned or exchanged within 30
                days, online or in store.
              </p>
            </Disclosure>
            <Disclosure title="Care">
              <p>
                Store in the dust bag provided, away from direct sunlight and
                humidity. Our ateliers offer care and repair services for the
                lifetime of the piece.
              </p>
            </Disclosure>
          </div>
        </div>
      </div>

      <section className="container-page pb-section" aria-labelledby="related-title">
        <h2 id="related-title" className="mb-6 text-heading">
          You may also like
        </h2>
        <div className="grid-products">
          {relatedProducts.map((related) => (
            <ProductCard key={related.slug} product={related} />
          ))}
        </div>
      </section>
    </>
  );
}

// Swipeable row on small screens, stacked column beside the details on desktop.
// The second view is a close-up cropped from the main image at `detailFocus`.
function Gallery({ product }: { product: Product }) {
  return (
    <div className="-mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-(--grid-gap-x) overflow-x-auto px-gutter [scrollbar-width:none] lg:col-span-7 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      <div className="media-cover aspect-product w-[88%] shrink-0 snap-start sm:w-[70%] lg:w-full">
        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          sizes="(min-width: 64rem) 58vw, 88vw"
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className="media-cover aspect-product w-[88%] shrink-0 snap-start sm:w-[70%] lg:w-full">
        <Image
          src={product.image}
          alt={`Close-up of the ${product.name}`}
          fill
          sizes="(min-width: 64rem) 100vw, 160vw"
          className="scale-[1.8]"
          style={{
            objectPosition: product.detailFocus,
            transformOrigin: product.detailFocus,
          }}
        />
      </div>
    </div>
  );
}

function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group border-b" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-body-sm [&::-webkit-details-marker]:hidden">
        {title}
        <PlusIcon className="transition-transform group-open:rotate-45" />
      </summary>
      <div className="pb-6 text-body-sm text-muted">{children}</div>
    </details>
  );
}
