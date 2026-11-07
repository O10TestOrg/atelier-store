import { asc, desc, eq, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, products } from "@/db/schema";

export type Product = Omit<
  typeof products.$inferSelect,
  "id" | "categoryId" | "createdAt" | "updatedAt"
> & {
  category: { name: string; slug: string };
};

// Shared column shape so every query returns a `Product`.
const productFields = {
  slug: products.slug,
  name: products.name,
  reference: products.reference,
  price: products.price,
  stock: products.stock,
  image: products.image,
  imageAlt: products.imageAlt,
  detailFocus: products.detailFocus,
  isNew: products.isNew,
  colour: products.colour,
  description: products.description,
  details: products.details,
  category: { name: categories.name, slug: categories.slug },
};

const selectProducts = () =>
  db
    .select(productFields)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id));

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts().orderBy(asc(products.id));
}

export async function getProductSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return db
    .select({ slug: products.slug })
    .from(products)
    .orderBy(asc(products.id));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("products", `product:${slug}`);

  const [product] = await selectProducts()
    .where(eq(products.slug, slug))
    .limit(1);
  return product;
}

// Same-category products first, then the rest of the catalog.
export async function getRelatedProducts(
  slug: string,
  categorySlug: string,
  limit = 4,
): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts()
    .where(ne(products.slug, slug))
    .orderBy(desc(sql`${categories.slug} = ${categorySlug}`), asc(products.id))
    .limit(limit);
}
