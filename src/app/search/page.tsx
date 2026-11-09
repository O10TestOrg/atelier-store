import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { SearchForm, SearchFormFallback } from "@/components/search-form";
import { SortableProductGrid } from "@/components/sortable-product-grid";
import { categoryHref, normalizeSearchQuery } from "@/lib/catalog";
import { getAllProducts, getCategories, searchProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse and search Atelier's leather goods, clothing and accessories.",
  robots: { index: false },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
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
            Shop all
          </li>
        </ol>
      </nav>

      <header className="container-prose pt-6 pb-10 text-center md:pt-8 md:pb-12">
        <p className="text-eyebrow text-muted">The collection</p>
        <h1 className="mt-4 text-display">Shop all</h1>
        <div className="mt-10 text-left">
          <Suspense fallback={<SearchFormFallback />}>
            <SearchForm />
          </Suspense>
        </div>
      </header>

      <section className="container-page pb-section" aria-labelledby="results-title">
        <h2 id="results-title" className="sr-only">
          Products
        </h2>
        <Suspense fallback={<ResultsSkeleton />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  );
}

async function SearchResults({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const query = normalizeSearchQuery((await searchParams).q);
  const [products, categories] = await Promise.all([
    query ? searchProducts(query) : getAllProducts(),
    getCategories(),
  ]);

  const browse = (
    <nav aria-label="Browse collections" className="mt-8">
      <ul className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link href={categoryHref(category.slug)} className="btn btn-secondary btn-sm">
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  // Nothing typed yet: the whole catalogue, sortable like a collection page.
  if (!query) {
    if (products.length === 0) {
      return (
        <div className="border-t pt-section text-center">
          <p className="text-muted">New pieces are on their way. Check back soon.</p>
          {browse}
        </div>
      );
    }
    return (
      <>
        <div className="mb-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
          <nav aria-label="Collections" className="-mx-gutter overflow-x-auto px-gutter [scrollbar-width:none] sm:mx-0 sm:px-0">
            <ul className="flex gap-6 text-body-sm whitespace-nowrap">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={categoryHref(category.slug)} className="link-quiet">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="shrink-0 text-meta">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
        </div>
        <SortableProductGrid
          items={products.map((product) => ({
            key: product.slug,
            price: product.price,
            isNew: product.isNew,
            card: <ProductCard product={product} />,
          }))}
        />
      </>
    );
  }

  return (
    <>
      {/* With no results the heading below says it, so the count is for screen readers only. */}
      <div className={products.length > 0 ? "mb-6 border-t pt-4" : "border-t"}>
        <p className={products.length > 0 ? "text-meta" : "sr-only"} role="status">
          {products.length} {products.length === 1 ? "result" : "results"} for{" "}
          <span className="text-foreground">“{query}”</span>
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
          <p className="text-heading-sm">Nothing matched “{query}”</p>
          <p className="mt-2 text-muted">
            Check the spelling, try a broader word like “bag” or “black”, or
            browse a collection.
          </p>
          {browse}
          <Link href="/search" className="btn btn-primary mt-8">
            Clear search
          </Link>
        </div>
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 border-t pt-4">
        <div className="h-5 w-32 animate-pulse bg-surface" />
      </div>
      <div className="grid-products">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="aspect-product animate-pulse bg-surface" />
            <div className="mt-3 h-4 w-2/3 animate-pulse bg-surface" />
            <div className="mt-2 h-4 w-1/4 animate-pulse bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
