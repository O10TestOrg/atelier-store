import "server-only";
import { db } from "@/db";
import { categories, orderItems, orders, products } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
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

// Live stock for one product, for actions that must not trust the cached page.
export async function getProductAvailability(slug: string) {
  const [row] = await db
    .select({ id: products.id, name: products.name, stock: products.stock })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row;
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

export type CategoryTile = Category & { image: string; imageAlt: string };

// Each category that has products, pictured by its newest piece, for the home
// page. Empty categories are left out rather than shown without a photo.
export async function getCategoryTiles(): Promise<CategoryTile[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return db
    .selectDistinctOn([categories.id], {
      name: categories.name,
      slug: categories.slug,
      image: products.image,
      imageAlt: products.imageAlt,
    })
    .from(categories)
    .innerJoin(products, eq(products.categoryId, categories.id))
    .orderBy(asc(categories.id), desc(products.isNew), desc(products.createdAt), desc(products.id));
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

// --- Admin -------------------------------------------------------------------
// Staff views and writes. Callers must have passed `requireAdmin()` (pages) or
// `assertAdmin()` (actions) first. Reads are uncached: admins need live stock.
// Writes are single statements; callers then `updateTag("products")`.

export type AdminProduct = typeof products.$inferSelect & {
  category: Category;
  // Units reserved by checkouts still awaiting payment.
  held: number;
};

const heldStock = db
  .select({
    productId: orderItems.productId,
    quantity: sql<number>`sum(${orderItems.quantity})::integer`.as("quantity"),
  })
  .from(orderItems)
  .innerJoin(orders, eq(orders.id, orderItems.orderId))
  .where(eq(orders.status, "pending"))
  .groupBy(orderItems.productId)
  .as("held_stock");

const selectAdminProducts = () =>
  db
    .select({
      product: products,
      category: { name: categories.name, slug: categories.slug },
      held: sql<number>`coalesce(${heldStock.quantity}, 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(heldStock, eq(heldStock.productId, products.id));

export async function getAdminProducts(categorySlug?: string): Promise<AdminProduct[]> {
  const rows = await selectAdminProducts()
    .where(categorySlug ? eq(categories.slug, categorySlug) : undefined)
    .orderBy(asc(products.id));
  return rows.map(({ product, category, held }) => ({ ...product, category, held }));
}

export async function getAdminProduct(id: number): Promise<AdminProduct | undefined> {
  const [row] = await selectAdminProducts().where(eq(products.id, id)).limit(1);
  return row && { ...row.product, category: row.category, held: row.held };
}

export type AdminCategory = Category & { id: number; productCount: number };

export async function getAdminCategories(): Promise<AdminCategory[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.id));
}

// Everything an admin can edit after creation. Slug and stock are excluded:
// slug is fixed once created, and stock changes go through `setStockIfUnchanged`.
export type ProductDetails = Omit<
  typeof products.$inferInsert,
  "id" | "slug" | "stock" | "createdAt" | "updatedAt"
>;

export async function insertProduct(
  input: ProductDetails & { slug: string; stock: number },
): Promise<number> {
  const [row] = await db.insert(products).values(input).returning({ id: products.id });
  return row.id;
}

export async function updateProductDetails(id: number, input: ProductDetails) {
  const [row] = await db
    .update(products)
    .set(input)
    .where(eq(products.id, id))
    .returning({ id: products.id });
  return Boolean(row);
}

// Compare-and-set, so an admin working from a stale page can't overwrite a
// reservation a checkout made in the meantime. Returns the stock now stored,
// or null when the product no longer exists.
export async function setStockIfUnchanged(id: number, expected: number, stock: number) {
  const [updated] = await db
    .update(products)
    .set({ stock })
    .where(and(eq(products.id, id), eq(products.stock, expected)))
    .returning({ stock: products.stock });
  if (updated) return { updated: true, stock: updated.stock } as const;

  const [current] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, id));
  return current ? ({ updated: false, stock: current.stock } as const) : null;
}

export async function insertCategory(input: Category) {
  await db.insert(categories).values(input);
}

export async function renameCategory(id: number, name: string) {
  const [row] = await db
    .update(categories)
    .set({ name })
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  return Boolean(row);
}

// `products.category_id` is `on delete restrict`, so this throws a restrict
// violation (23001) while any product is still in the category.
export async function deleteCategory(id: number) {
  const [row] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  return Boolean(row);
}
