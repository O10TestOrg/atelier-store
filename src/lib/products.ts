import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeSearchQuery } from "@/lib/catalog";

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

// Products flagged as new, most recently added first; id breaks ties between
// rows inserted together.
export async function getNewArrivals(limit = 24): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts()
    .where(eq(products.isNew, true))
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit);
}

// Deliberately uncached: the bag must show today's price and stock, not the
// copy cached for the catalog. Callers that render it sit inside <Suspense>.
export async function getCartProducts(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  return selectProducts().where(inArray(products.slug, slugs));
}

export type CheckoutProduct = Product & { id: number };

// Same as `getCartProducts`, plus the row id that orders and the stock
// reservation need. Uncached: checkout must price and reserve from live rows.
export async function getCheckoutProducts(slugs: string[]): Promise<CheckoutProduct[]> {
  if (slugs.length === 0) return [];
  return db
    .select({ id: products.id, ...productFields })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(products.slug, slugs));
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

export type Category = { name: string; slug: string };

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .orderBy(asc(categories.id));
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const [category] = await db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return category;
}

export async function getCategoryProducts(
  categorySlug: string,
): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts()
    .where(eq(categories.slug, categorySlug))
    .orderBy(asc(products.id));
}

// Every word must appear in the name, colour, category, reference, description
// or details. Name matches rank first.
export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const terms = normalizeSearchQuery(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const pattern = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const matchesTerm = (term: string) =>
    or(
      ilike(products.name, pattern(term)),
      ilike(products.colour, pattern(term)),
      ilike(categories.name, pattern(term)),
      ilike(products.reference, pattern(term)),
      ilike(products.description, pattern(term)),
      sql`array_to_string(${products.details}, ' ') ilike ${pattern(term)}`,
    );
  const nameMatches = and(...terms.map((term) => ilike(products.name, pattern(term))));

  return selectProducts()
    .where(and(...terms.map(matchesTerm)))
    .orderBy(desc(sql`coalesce(${nameMatches}, false)`), asc(products.id))
    .limit(48);
}
