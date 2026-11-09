import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  createCategory,
  removeCategory,
  updateCategoryName,
} from "@/features/admin/actions/categories";
import { CategoryRow, CreateCategoryForm } from "@/features/admin/components/category-forms";
import { categoryHref } from "@/features/catalog/catalog";
import { getAdminCategories } from "@/features/catalog/products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Categories",
};

export default function AdminCategoriesPage() {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Categories</h1>
        <p className="mt-4 max-w-prose text-muted">
          Each category has a collection page in the store. A category can only be deleted
          once it has no products.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-96 animate-pulse bg-surface" />}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  await requireAdmin("/admin/categories");
  const categories = await getAdminCategories();

  return (
    <>
      {categories.length === 0 ? (
        <p className="mt-10 border-t pt-10 text-muted">No categories yet.</p>
      ) : (
        <ul className="mt-10 border-t">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-1 border-b sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <CategoryRow
                name={category.name}
                productCount={category.productCount}
                rename={updateCategoryName.bind(null, category.id)}
                remove={removeCategory.bind(null, category.id)}
              />
              <p className="pb-4 text-meta sm:pb-0 sm:text-right">
                <Link
                  href={`/admin/products?category=${category.slug}`}
                  className="link-quiet"
                >
                  {category.productCount} {category.productCount === 1 ? "product" : "products"}
                </Link>{" "}
                ·{" "}
                <Link href={categoryHref(category.slug)} className="link-quiet">
                  /collections/{category.slug}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="new-category" className="mt-12 bg-surface p-6 md:p-8">
        <h2 id="new-category" className="mb-6 text-heading-sm">
          Add a category
        </h2>
        <CreateCategoryForm action={createCategory} />
      </section>
    </>
  );
}
