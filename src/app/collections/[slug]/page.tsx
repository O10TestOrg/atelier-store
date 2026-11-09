import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { SortableProductGrid } from "@/components/sortable-product-grid";
import { categoryHref, services } from "@/lib/catalog";
import {
  getCategories,
  getCategory,
  getCategoryProducts,
} from "@/lib/products";

// Render unlisted slugs fully before responding, so notFound() sends a real
// 404 instead of a 200 from the streamed fallback shell.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return getCategories();
}

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return {};

  return {
    title: category.name,
    description: `Discover ${category.name.toLowerCase()} from Atelier, made with care in our workshops.`,
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/collections/[slug]">) {
  const category = await getCategory((await params).slug);
  if (!category) notFound();

  const [products, categories] = await Promise.all([
    getCategoryProducts(category.slug),
    getCategories(),
  ]);

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
            {category.name}
          </li>
        </ol>
      </nav>

      <header className="container-prose pt-6 pb-section text-center md:pt-8">
        <p className="text-eyebrow text-muted">The collection</p>
        <h1 className="mt-4 text-display">{category.name}</h1>
        <p className="mt-4 text-muted">
          Each piece is cut, stitched and finished by hand in our workshops,
          in materials chosen to wear in rather than out.
        </p>
      </header>

      <section className="container-page pb-section" aria-labelledby="products-title">
        <div className="mb-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="products-title" className="sr-only">
            Products
          </h2>
          <nav aria-label="Collections" className="-mx-gutter overflow-x-auto px-gutter [scrollbar-width:none] sm:mx-0 sm:px-0">
            <ul className="flex gap-6 text-body-sm whitespace-nowrap">
              {categories.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={categoryHref(item.slug)}
                    className="link-quiet"
                    aria-current={item.slug === category.slug ? "page" : undefined}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="shrink-0 text-meta">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
        </div>

        {products.length > 0 ? (
          <SortableProductGrid
            items={products.map((product) => ({
              key: product.slug,
              price: product.price,
              isNew: product.isNew,
              card: <ProductCard product={product} />,
            }))}
          />
        ) : (
          <div className="mx-auto flex max-w-prose flex-col items-center py-section text-center">
            <p className="text-muted">
              New pieces for this collection are on their way. Check back soon.
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
