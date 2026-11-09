import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  changeProductStatus,
  deleteProduct,
  updateProduct,
  updateStock,
} from "@/app/admin/products/actions";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { HistoryList } from "@/components/admin/history-list";
import { ProductForm } from "@/components/admin/product-form";
import { ProductStatus } from "@/components/admin/product-status";
import { StockForm } from "@/components/admin/stock-form";
import { getEntityHistory } from "@/lib/admin-events";
import { isValidId, parseInteger } from "@/lib/product-form";
import {
  getAdminCategories,
  getAdminProduct,
  productHasOrders,
  type AdminProduct,
} from "@/lib/products";
import { requireAdmin } from "@/lib/session";
import { getUploadHost } from "@/lib/uploads";
import { SignalMessage } from "@/components/signal";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Edit product",
};

export default function EditProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]/edit">) {
  return (
    <>
      <Link href="/admin/products" className="link-quiet text-body-sm text-muted">
        <ArrowLeftIcon /> All products
      </Link>
      <Suspense fallback={<EditSkeleton />}>
        <EditProduct params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EditProduct({
  params,
  searchParams,
}: Pick<PageProps<"/admin/products/[id]/edit">, "params" | "searchParams">) {
  const { id: rawId } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(rawId)}/edit`);

  const id = parseInteger(rawId);
  if (!isValidId(id)) notFound();
  const [product, categories, ordered, history] = await Promise.all([
    getAdminProduct(id),
    getAdminCategories(),
    productHasOrders(id),
    getEntityHistory("product", String(id)),
  ]);
  if (!product) notFound();
  const { created } = await searchParams;

  return (
    <>
      <header className="mt-8 mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-eyebrow text-muted">Ref. {product.reference}</p>
          <h1 className="mt-4 text-heading">{product.name}</h1>
          {created && (
            <SignalMessage tone="success" role="status" className="mt-4">
              Product created as a draft. Publish it when it’s ready.
            </SignalMessage>
          )}
        </div>
        {product.status === "active" && (
          <Link href={`/products/${product.slug}`} className="link text-body-sm">
            View in store
          </Link>
        )}
      </header>

      <StatusPanel product={product} ordered={ordered} />

      <section aria-labelledby="stock-title" className="mb-12 bg-surface p-6 md:p-8">
        <h2 id="stock-title" className="text-heading-sm">
          Availability
        </h2>
        <p className="mt-2 max-w-prose text-meta">
          {product.stock === 0 ? "Sold out in the store." : `${product.stock} available to buy.`}
          {product.held > 0 && ` ${product.held} more held by checkouts awaiting payment.`}{" "}
          Set to 0 to mark it sold out.
        </p>
        {product.held > 0 && (
          <p className="mt-2 max-w-prose text-meta">
            Stocktake? Enter what’s on the shelf <strong>minus the {product.held} held</strong>.
            Held pieces return on their own if the checkout lapses.
          </p>
        )}
        <div className="mt-6">
          <StockForm
            action={updateStock.bind(null, product.id)}
            stock={product.stock}
            productName={product.name}
            layout="stacked"
          />
        </div>
      </section>

      <h2 className="mb-6 text-heading-sm">Details</h2>
      <ProductForm
        action={updateProduct.bind(null, product.id)}
        categories={categories}
        product={product}
        uploadHost={getUploadHost()}
      />

      <section aria-labelledby="history-title" className="mt-16">
        <h2 id="history-title" className="mb-2 text-heading-sm">
          History
        </h2>
        <p className="mb-6 max-w-prose text-meta">
          Admin changes, newest first. Stock moved by checkouts is in Orders.
        </p>
        <HistoryList
          events={history}
          categoryNames={new Map(categories.map((c) => [c.id, c.name]))}
        />
      </section>
    </>
  );
}

const statusCopy = {
  draft: "Not in the store yet. Publish it when the details are ready.",
  active: "In the store: shoppers can find it, save it and buy it.",
  archived:
    "Out of the store. Its page is gone, and it’s dropped from bags, wishlists and search. Past orders still show it.",
};

function StatusPanel({ product, ordered }: { product: AdminProduct; ordered: boolean }) {
  const canDelete = product.status !== "active";
  return (
    <section aria-labelledby="status-title" className="mb-12 border p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="status-title" className="text-heading-sm">
          Status
        </h2>
        <ProductStatus status={product.status} />
      </div>
      <p className="mt-2 max-w-prose text-meta">{statusCopy[product.status]}</p>
      <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4">
        {product.status !== "active" && (
          <ConfirmAction
            action={changeProductStatus.bind(null, product.id, "active")}
            label={product.status === "draft" ? "Publish" : "Publish again"}
            variant="primary"
          />
        )}
        {product.status === "active" && (
          <ConfirmAction
            action={changeProductStatus.bind(null, product.id, "archived")}
            label="Archive"
            confirm={`Archive “${product.name}”? It leaves the store straight away: its page stops working and it drops out of bags, wishlists and search. You can publish it again later.`}
            confirmLabel="Archive it"
          />
        )}
        {canDelete && (
          <ConfirmAction
            action={deleteProduct.bind(null, product.id)}
            label="Delete permanently"
            variant="ghost"
            confirm={`Delete “${product.name}” (${product.reference}) for good? This can’t be undone. Its history stays in Activity.`}
            confirmLabel="Delete it"
            disabled={ordered}
            disabledReason={ordered ? "Orders include it, so it can only be archived." : undefined}
          />
        )}
      </div>
    </section>
  );
}

function EditSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-8 h-4 w-32 animate-pulse bg-surface" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse bg-surface" />
      <div className="mt-10 h-32 animate-pulse bg-surface" />
      <div className="mt-12 h-40 animate-pulse bg-surface" />
      <div className="mt-12 h-96 animate-pulse bg-surface" />
    </div>
  );
}
