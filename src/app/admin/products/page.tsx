import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { updateStock } from "@/app/admin/products/actions";
import { StockForm } from "@/components/admin/stock-form";
import { formatPrice } from "@/lib/catalog";
import { getAdminCategories, getAdminProducts } from "@/lib/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Products",
};

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-eyebrow text-muted">Admin</p>
          <h1 className="mt-4 text-heading">Products</h1>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          Add product
        </Link>
      </header>
      <Suspense fallback={<TableSkeleton />}>
        <ProductTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProductTable({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  await requireAdmin("/admin/products");

  const { category } = await searchParams;
  const categories = await getAdminCategories();
  // Ignore anything that isn't a real category slug.
  const active = categories.find((c) => c.slug === category);
  const products = await getAdminProducts(active?.slug);

  return (
    <>
      <nav aria-label="Filter by category" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        <Link
          href="/admin/products"
          className="link-quiet aria-[current=page]:underline"
          aria-current={active ? undefined : "page"}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/admin/products?category=${c.slug}`}
            className="link-quiet aria-[current=page]:underline"
            aria-current={active?.slug === c.slug ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <p className="mt-10 border-t pt-10 text-muted">No products here yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-t text-left text-body-sm">
            <caption className="sr-only">
              Products{active ? ` in ${active.name}` : ""}, with stock you can update
            </caption>
            <thead className="text-meta">
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 font-normal">Product</th>
                <th scope="col" className="py-3 pr-4 font-normal">Category</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Price</th>
                <th scope="col" className="py-3 pr-4 font-normal">Stock</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">
                  <abbr title="Reserved by checkouts awaiting payment" className="no-underline">
                    Held
                  </abbr>
                </th>
                <th scope="col" className="py-3 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b align-top">
                  <th scope="row" className="py-4 pr-4 font-normal">
                    <Link href={`/admin/products/${product.id}/edit`} className="link-quiet">
                      {product.name}
                    </Link>
                    <p className="mt-1 text-meta">
                      Ref. {product.reference}
                      {product.isNew && " · New"}
                    </p>
                  </th>
                  <td className="py-4 pr-4">{product.category.name}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{formatPrice(product.price)}</td>
                  <td className="py-3 pr-4">
                    <StockForm
                      action={updateStock.bind(null, product.id)}
                      stock={product.stock}
                      productName={product.name}
                    />
                    {product.stock === 0 && <p className="mt-1 text-caption text-muted">Sold out</p>}
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums text-muted">{product.held}</td>
                  <td className="py-4 text-right whitespace-nowrap">
                    <Link href={`/admin/products/${product.id}/edit`} className="link">
                      Edit
                    </Link>
                    <span className="sr-only"> {product.name}</span>
                    <span aria-hidden="true" className="px-2 text-muted">·</span>
                    <Link href={`/products/${product.slug}`} className="link-quiet text-muted">
                      View<span className="sr-only"> {product.name} in the store</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8">
      <div className="h-5 w-72 max-w-full animate-pulse bg-surface" />
      <div className="mt-6 border-t">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="border-b py-4">
            <div className="h-10 animate-pulse bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
