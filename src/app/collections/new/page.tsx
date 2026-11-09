import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/features/catalog/product-card";
import { services } from "@/features/catalog/catalog";
import { getNewArrivals } from "@/features/catalog/products";

export const metadata: Metadata = {
  title: "New arrivals",
  description:
    "The latest leather goods, clothing and accessories from the new season.",
};

export default async function NewArrivalsPage() {
  const products = await getNewArrivals();

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
            New arrivals
          </li>
        </ol>
      </nav>

      <header className="container-prose pt-6 pb-section text-center md:pt-8">
        <p className="text-eyebrow text-muted">Just in</p>
        <h1 className="mt-4 text-display">New arrivals</h1>
        <p className="mt-4 text-muted">
          The latest pieces from the atelier, from supple leather bags to
          tailored outerwear, added as each one leaves the workshop.
        </p>
      </header>

      <section className="container-page pb-section" aria-labelledby="products-title">
        <div className="mb-6 flex items-end justify-between gap-4 border-t pt-4">
          <h2 id="products-title" className="sr-only">
            Products
          </h2>
          <p className="text-meta">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
        </div>

        {products.length > 0 ? (
          <div className="grid-products">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="mx-auto flex max-w-prose flex-col items-center py-section text-center">
            <p className="text-muted">
              New pieces are on their way. Check back soon.
            </p>
            <Link href="/search" className="btn btn-primary mt-8">
              Shop all
            </Link>
          </div>
        )}
      </section>

      <section className="container-page pb-section" aria-labelledby="services-title">
        <h2 id="services-title" className="sr-only">
          Atelier services
        </h2>
        <ul className="grid gap-px border bg-line sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.title} className="bg-background p-6 md:p-8">
              <h3 className="text-body-sm">{service.title}</h3>
              <p className="mt-2 text-meta">{service.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
