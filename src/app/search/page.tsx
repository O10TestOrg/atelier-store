import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { SearchForm, SearchFormFallback } from "@/components/search-form";
import { categoryHref, normalizeSearchQuery } from "@/lib/catalog";
import { getCategories, searchProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Atelier's leather goods, ready-to-wear and accessories.",
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
            Search
          </li>
        </ol>
      </nav>

      <header className="container-prose pt-6 pb-10 text-center md:pt-8 md:pb-12">
        <p className="text-eyebrow text-muted">Search</p>
        <h1 className="mt-4 text-display">Find a piece</h1>
        <div className="mt-10 text-left">
          <Suspense fallback={<SearchFormFallback />}>
            <SearchForm />
          </Suspense>
        </div>
      </header>

      <section className="container-page pb-section" aria-labelledby="results-title">
        <h2 id="results-title" className="sr-only">
          Search results
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
    searchProducts(query),
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

  if (!query) {
    return (
      <div className="border-t pt-section text-center">
        <p className="text-muted">Search by name, colour, material or collection.</p>
        {browse}
      </div>
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
          <Link href="/collections/new" className="btn btn-primary mt-8">
            Shop new arrivals
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
