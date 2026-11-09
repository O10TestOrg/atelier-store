import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createProduct } from "@/features/admin/actions/products";
import { ProductForm } from "@/features/admin/components/product-form";
import { getAdminCategories } from "@/features/catalog/products";
import { requireAdmin } from "@/lib/session";
import { getUploadHost } from "@/lib/uploads";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Add product",
};

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/products" className="link-quiet text-body-sm text-muted">
        <ArrowLeftIcon /> All products
      </Link>
      <header className="mt-8 mb-10">
        <p className="text-eyebrow text-muted">Products</p>
        <h1 className="mt-4 text-heading">Add product</h1>
        <p className="mt-4 max-w-prose text-muted">
          New products start as drafts, out of the store, until you publish them.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse bg-surface" />}>
        <NewProductForm />
      </Suspense>
    </>
  );
}

async function NewProductForm() {
  await requireAdmin("/admin/products/new");
  const categories = await getAdminCategories();

  if (categories.length === 0) {
    return (
      <p className="text-muted">
        Products need a category.{" "}
        <Link href="/admin/categories" className="link text-foreground">
          Add one first
        </Link>
        .
      </p>
    );
  }
  return (
    <ProductForm action={createProduct} categories={categories} uploadHost={getUploadHost()} />
  );
}
