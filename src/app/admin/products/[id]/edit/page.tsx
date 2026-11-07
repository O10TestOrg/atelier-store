import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateProduct, updateStock } from "@/app/admin/products/actions";
import { ProductForm } from "@/components/admin/product-form";
import { StockForm } from "@/components/admin/stock-form";
import { isValidId, parseInteger } from "@/lib/product-form";
import { getAdminCategories, getAdminProduct } from "@/lib/products";
import { requireAdmin } from "@/lib/session";
import { SignalMessage } from "@/components/signal";

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
        <span aria-hidden="true">←</span> All products
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
  const [product, categories] = await Promise.all([getAdminProduct(id), getAdminCategories()]);
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
              Product created.
            </SignalMessage>
          )}
        </div>
        <Link href={`/products/${product.slug}`} className="link text-body-sm">
          View in store
        </Link>
      </header>

      <section aria-labelledby="stock-title" className="mb-12 bg-surface p-6 md:p-8">
        <h2 id="stock-title" className="text-heading-sm">
          Availability
        </h2>
        <p className="mt-2 max-w-prose text-meta">
          {product.stock === 0 ? "Sold out in the store." : `${product.stock} available to buy.`}
          {product.held > 0 && ` ${product.held} more held by checkouts awaiting payment.`}{" "}
          Set to 0 to mark it sold out.
        </p>
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
      />
    </>
  );
}

function EditSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-8 h-4 w-32 animate-pulse bg-surface" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse bg-surface" />
      <div className="mt-10 h-40 animate-pulse bg-surface" />
      <div className="mt-12 h-96 animate-pulse bg-surface" />
    </div>
  );
}
