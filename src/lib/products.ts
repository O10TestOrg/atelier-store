import "server-only";
import { db } from "@/db";
import { categories, orderItems, orders, products, type ProductStatus } from "@/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { writeWithEvent, type AdminEventInput } from "@/lib/admin-events";
import { LOW_STOCK, normalizeSearchQuery } from "@/lib/catalog";
import type { FieldChanges } from "@/lib/field-changes";

export type Product = Omit<
  typeof products.$inferSelect,
  "id" | "categoryId" | "createdAt" | "updatedAt" | "status" | "publishedAt" | "version"
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

// The store only ever sees active products: drafts and archived pieces 404,
// drop out of bags and wishlists, and can't be checked out.
const isLive = eq(products.status, "active");

const selectProducts = (where?: SQL) =>
  db
    .select(productFields)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(isLive, where));

// `term` as an ILIKE pattern that matches it anywhere, wildcards escaped.
export const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

// Products flagged as new, most recently added first; id breaks ties between
// rows inserted together.
export async function getNewArrivals(limit = 24): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts(eq(products.isNew, true))
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit);
}

// Deliberately uncached: the bag must show today's price and stock, not the
// copy cached for the catalog. Callers that render it sit inside <Suspense>.
export async function getCartProducts(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  return selectProducts(inArray(products.slug, slugs));
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
    .where(and(isLive, inArray(products.slug, slugs)));
}

// Live stock for one product, for actions that must not trust the cached page.
export async function getProductAvailability(slug: string) {
  const [row] = await db
    .select({ id: products.id, name: products.name, stock: products.stock })
    .from(products)
    .where(and(isLive, eq(products.slug, slug)))
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
    .where(isLive)
    .orderBy(asc(products.id));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("products", `product:${slug}`);

  const [product] = await selectProducts(eq(products.slug, slug)).limit(1);
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

  return selectProducts(ne(products.slug, slug))
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

// Each category that has live products, pictured by its newest piece, for the
// home page. Empty categories are left out rather than shown without a photo,
// so a tile can never link to an empty or deleted collection.
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
    .innerJoin(products, and(eq(products.categoryId, categories.id), isLive))
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

  return selectProducts(eq(categories.slug, categorySlug))
    .orderBy(asc(products.id));
}

// The whole live catalogue, for /search before anything is typed.
export async function getAllProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  return selectProducts().orderBy(asc(products.id));
}

// Every word must appear in the name, colour, category, reference, description
// or details. Name matches rank first.
export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");

  const terms = normalizeSearchQuery(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const matchesTerm = (term: string) =>
    or(
      ilike(products.name, likePattern(term)),
      ilike(products.colour, likePattern(term)),
      ilike(categories.name, likePattern(term)),
      ilike(products.reference, likePattern(term)),
      ilike(products.description, likePattern(term)),
      sql`array_to_string(${products.details}, ' ') ilike ${likePattern(term)}`,
    );
  const nameMatches = and(...terms.map((term) => ilike(products.name, likePattern(term))));

  return selectProducts(and(...terms.map(matchesTerm)))
    .orderBy(desc(sql`coalesce(${nameMatches}, false)`), asc(products.id))
    .limit(48);
}

// --- Admin -------------------------------------------------------------------
// Staff views and writes. Callers must have passed `requireAdmin()` (pages) or
// `assertAdmin()` (actions) first. Reads are uncached: admins need live stock.
// Writes are single statements that also record the change in the admin
// history (`writeWithEvent`); callers then `updateTag("products")`.

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

const adminProductFields = {
  product: products,
  category: { name: categories.name, slug: categories.slug },
  held: sql<number>`coalesce(${heldStock.quantity}, 0)`.mapWith(Number),
};

const toAdminProduct = ({ product, category, held }: {
  product: typeof products.$inferSelect;
  category: Category;
  held: number;
}): AdminProduct => ({ ...product, category, held });

export const ADMIN_PRODUCTS_PER_PAGE = 50;

export type AdminProductQuery = {
  categorySlug?: string;
  status?: ProductStatus;
  lowStock?: boolean;
  // Matches name, reference or slug.
  q?: string;
  page: number;
};

export async function getAdminProducts(query: AdminProductQuery) {
  const q = query.q?.trim();
  const where = and(
    query.categorySlug ? eq(categories.slug, query.categorySlug) : undefined,
    query.status ? eq(products.status, query.status) : undefined,
    query.lowStock ? lte(products.stock, LOW_STOCK) : undefined,
    q
      ? or(
          ilike(products.name, likePattern(q)),
          ilike(products.reference, likePattern(q)),
          ilike(products.slug, likePattern(q)),
        )
      : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(adminProductFields)
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(heldStock, eq(heldStock.productId, products.id))
      .where(where)
      .orderBy(asc(products.id))
      .limit(ADMIN_PRODUCTS_PER_PAGE)
      .offset((query.page - 1) * ADMIN_PRODUCTS_PER_PAGE),
    db
      .select({ total: count() })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where),
  ]);
  return { products: rows.map(toAdminProduct), total };
}

export async function getAdminProduct(id: number): Promise<AdminProduct | undefined> {
  const [row] = await db
    .select(adminProductFields)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(heldStock, eq(heldStock.productId, products.id))
    .where(eq(products.id, id))
    .limit(1);
  return row && toAdminProduct(row);
}

// Whether any order, in any status, includes the product. Ordered products
// can't be deleted, only archived.
export async function productHasOrders(id: number) {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, id))
    .limit(1);
  return Boolean(row);
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

type Actor = AdminEventInput["actor"];

// Everything an admin can edit in the details form. Stock and status have
// their own writes, and slug only changes while the product was never live.
export type ProductDetails = Omit<
  typeof products.$inferInsert,
  "id" | "slug" | "stock" | "status" | "publishedAt" | "version" | "createdAt" | "updatedAt"
>;

// New products start as drafts, out of the store until published.
export async function insertProduct(
  input: ProductDetails & { slug: string; stock: number },
  actor: Actor,
): Promise<number> {
  const [row] = await writeWithEvent<{ id: number }>(
    db.insert(products).values({ ...input, status: "draft" }).returning({ id: products.id }),
    {
      actor,
      entity: "product",
      action: "create",
      label: input.name,
      changes: {
        status: { from: null, to: "draft" },
        price: { from: null, to: input.price },
        stock: { from: null, to: input.stock },
      },
    },
  );
  return Number(row.id);
}

export type DetailsUpdate = ProductDetails & { slug?: string };

// Compare-and-set on `version`, so a save from a stale page can't revert a
// change someone made in the meantime. A slug change also requires that the
// product was never published. `changes` is the diff against the version the
// caller read, recorded in the history. Returns false on a miss.
export async function updateProductDetails(
  id: number,
  expectedVersion: number,
  input: DetailsUpdate,
  changes: FieldChanges,
  actor: Actor,
) {
  const rows = await writeWithEvent(
    db
      .update(products)
      .set({ ...input, version: sql`${products.version} + 1` })
      .where(
        and(
          eq(products.id, id),
          eq(products.version, expectedVersion),
          input.slug === undefined ? undefined : isNull(products.publishedAt),
        ),
      )
      .returning({ id: products.id }),
    { actor, entity: "product", action: "update", label: input.name, changes },
  );
  return rows.length > 0;
}

// Compare-and-set, so an admin working from a stale page can't overwrite a
// reservation a checkout made in the meantime. Returns the stock now stored,
// or null when the product no longer exists.
export async function setStockIfUnchanged(
  id: number,
  expected: number,
  stock: number,
  actor: Actor,
) {
  const [updated] = await writeWithEvent<{ id: number; stock: number }>(
    db
      .update(products)
      .set({ stock })
      .where(and(eq(products.id, id), eq(products.stock, expected)))
      .returning({ id: products.id, stock: products.stock }),
    {
      actor,
      entity: "product",
      action: "stock",
      // Read in the statement: the stock forms only post the number.
      label: sql`(select ${products.name} from ${products} where ${products.id} = ${id})`,
      changes: { stock: { from: expected, to: stock } },
    },
  );
  if (updated) return { updated: true, stock: Number(updated.stock) } as const;

  const [current] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, id));
  return current ? ({ updated: false, stock: current.stock } as const) : null;
}

// Moves a product from `from` to `to`, and only from `from`, so two admins
// can't undo each other unseen. Going live the first time stamps
// `published_at`, which fixes the slug for good. Bumps `version`, so an open
// details form on the old status is refused rather than applied.
export async function setProductStatus(
  id: number,
  from: ProductStatus,
  to: ProductStatus,
  actor: Actor,
  label: string,
) {
  const rows = await writeWithEvent(
    db
      .update(products)
      .set({
        status: to,
        publishedAt: to === "active" ? sql`coalesce(${products.publishedAt}, now())` : undefined,
        version: sql`${products.version} + 1`,
      })
      .where(and(eq(products.id, id), eq(products.status, from)))
      .returning({ id: products.id }),
    { actor, entity: "product", action: "status", label, changes: { status: { from, to } } },
  );
  return rows.length > 0;
}

// Permanent, so only for products out of the store that no order includes.
// Both conditions are in the statement, so a checkout can't slip in between
// a check and the delete. Wishlist rows and restock alerts cascade with it.
export async function deleteProductIfUnordered(id: number, actor: Actor, label: string) {
  const rows = await writeWithEvent(
    db
      .delete(products)
      .where(
        and(
          eq(products.id, id),
          ne(products.status, "active"),
          notExists(
            db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, id)),
          ),
        ),
      )
      .returning({ id: products.id }),
    { actor, entity: "product", action: "delete", label },
  );
  return rows.length > 0;
}

export async function insertCategory(input: Category, actor: Actor) {
  await writeWithEvent(
    db.insert(categories).values(input).returning({ id: categories.id }),
    {
      actor,
      entity: "category",
      action: "create",
      label: input.name,
      changes: { slug: { from: null, to: input.slug } },
    },
  );
}

export async function renameCategory(id: number, name: string, actor: Actor) {
  const [current] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, id));
  if (!current) return false;
  if (current.name === name) return true;

  const rows = await writeWithEvent(
    db
      .update(categories)
      .set({ name })
      .where(eq(categories.id, id))
      .returning({ id: categories.id }),
    {
      actor,
      entity: "category",
      action: "rename",
      label: name,
      changes: { name: { from: current.name, to: name } },
    },
  );
  return rows.length > 0;
}

// `products.category_id` is `on delete restrict`, so this throws a restrict
// violation (23001) while any product is still in the category.
export async function deleteCategory(id: number, actor: Actor) {
  const [current] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, id));
  if (!current) return false;

  const rows = await writeWithEvent(
    db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id }),
    { actor, entity: "category", action: "delete", label: current.name },
  );
  return rows.length > 0;
}
