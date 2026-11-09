import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { updateStock } from "@/app/admin/products/actions";
import { AdminPager, AdminSearch, listHref, param } from "@/components/admin/list-controls";
import { ProductStatus } from "@/components/admin/product-status";
import { StockForm } from "@/components/admin/stock-form";
import { ProductThumb } from "@/components/product-thumb";
import { SignalMessage, StatusDot } from "@/components/signal";
import { productStatuses, type ProductStatus as Status } from "@/db/schema";
import { LOW_STOCK, formatPrice } from "@/lib/catalog";
import { parseInteger } from "@/lib/product-form";
import {
  ADMIN_PRODUCTS_PER_PAGE,
  getAdminCategories,
  getAdminProducts,
} from "@/lib/products";
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

const statusFilters: { value: Status | undefined; label: string }[] = [
  { value: undefined, label: "Any status" },
  { value: "active", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

async function ProductTable({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  await requireAdmin("/admin/products");

  const params = await searchParams;
  const categories = await getAdminCategories();
  // Ignore anything that isn't a real category slug or status.
  const active = categories.find((c) => c.slug === param(params.category));
  const status = productStatuses.find((s) => s === param(params.status));
  const lowStock = param(params.stock) === "low";
  const q = param(params.q).slice(0, 200);
  const page = Math.max(1, parseInteger(param(params.page)) ?? 1);
  const deleted = param(params.deleted) === "1";

  const { products, total } = await getAdminProducts({
    categorySlug: active?.slug,
    status,
    lowStock,
    q,
    page,
  });
  const pages = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PER_PAGE));
  const filters = {
    category: active?.slug,
    status,
    stock: lowStock ? "low" : undefined,
    q: q || undefined,
  };
  const href = (changes: Partial<typeof filters> & { page?: number }) =>
    listHref("/admin/products", { ...filters, ...changes });

  return (
    <>
      {deleted && (
        <SignalMessage tone="success" role="status" className="mt-6">
          Product deleted.
        </SignalMessage>
      )}

      <div className="mt-8 flex flex-col gap-4">
        <AdminSearch
          action="/admin/products"
          label="Search products"
          placeholder="Name, reference or slug"
          defaultValue={q}
          keep={{ category: filters.category, status: filters.status, stock: filters.stock }}
        />
        <nav aria-label="Filter by category" className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          <Link
            href={href({ category: undefined })}
            className="link-quiet aria-[current=page]:underline"
            aria-current={active ? undefined : "page"}
          >
            All categories
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={href({ category: c.slug })}
              className="link-quiet aria-[current=page]:underline"
              aria-current={active?.slug === c.slug ? "page" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <nav aria-label="Filter by status and stock" className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          {statusFilters.map((f) => (
            <Link
              key={f.label}
              href={href({ status: f.value })}
              className="link-quiet aria-[current=page]:underline"
              aria-current={status === f.value ? "page" : undefined}
            >
              {f.label}
            </Link>
          ))}
          <span aria-hidden="true" className="text-muted">·</span>
          <Link
            href={href({ stock: lowStock ? undefined : "low" })}
            className="link-quiet aria-[current=page]:underline"
            aria-current={lowStock ? "page" : undefined}
          >
            Low stock ({LOW_STOCK} or fewer)
          </Link>
        </nav>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 border-t pt-10 text-muted">
          {q || status || lowStock || active ? "No products match these filters." : "No products here yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-t text-left text-body-sm">
            <caption className="sr-only">
              Products{active ? ` in ${active.name}` : ""}, with stock you can update
            </caption>
            <thead className="text-meta">
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 font-normal">Product</th>
                <th scope="col" className="py-3 pr-4 font-normal">Status</th>
                <th scope="col" className="py-3 pr-4 font-normal">Category</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Price</th>
                <th scope="col" className="py-3 pr-4 font-normal">
                  Available to sell
                  <span className="block text-caption">Excludes held</span>
                </th>
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
                  <th scope="row" className="py-3 pr-4 font-normal">
                    <div className="flex items-start gap-3">
                      <ProductThumb image={product.image} />
                      <div className="min-w-0 pt-1">
                        <Link href={`/admin/products/${product.id}/edit`} className="link-quiet">
                          {product.name}
                        </Link>
                        <p className="mt-1 text-meta">
                          Ref. {product.reference}
                          {product.isNew && " · New"}
                        </p>
                      </div>
                    </div>
                  </th>
                  <td className="py-4 pr-4 whitespace-nowrap">
                    <ProductStatus status={product.status} />
                  </td>
                  <td className="py-4 pr-4">{product.category.name}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{formatPrice(product.price)}</td>
                  <td className="py-3 pr-4">
                    <StockForm
                      action={updateStock.bind(null, product.id)}
                      stock={product.stock}
                      productName={product.name}
                    />
                    {product.stock === 0 ? (
                      <p className="mt-1 flex items-center gap-1.5 text-caption text-muted">
                        <StatusDot tone="danger" />
                        Sold out
                      </p>
                    ) : (
                      product.stock <= LOW_STOCK && (
                        <p className="mt-1 flex items-center gap-1.5 text-caption text-muted">
                          <StatusDot tone="warning" />
                          Low stock
                        </p>
                      )
                    )}
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums text-muted">{product.held}</td>
                  <td className="py-4 text-right whitespace-nowrap">
                    <Link href={`/admin/products/${product.id}/edit`} className="link">
                      Edit
                    </Link>
                    <span className="sr-only"> {product.name}</span>
                    {product.status === "active" && (
                      <>
                        <span aria-hidden="true" className="px-2 text-muted">·</span>
                        <Link href={`/products/${product.slug}`} className="link-quiet text-muted">
                          View<span className="sr-only"> {product.name} in the store</span>
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-meta">
        {total} {total === 1 ? "product" : "products"}
      </p>
      <AdminPager page={page} pages={pages} href={(p) => href({ page: p })} />
    </>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden="true" className="mt-8">
      <div className="h-10 w-96 max-w-full animate-pulse bg-surface" />
      <div className="mt-4 h-5 w-72 max-w-full animate-pulse bg-surface" />
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
