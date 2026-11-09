// Saved pieces. Guests keep them in a `wishlist` cookie of slugs; signed-in
// users keep them in `wishlist_items`, and the cookie mirrors that list.
//
// The cookie is deliberately readable by the client: product and collection
// pages are fully static (`ensureStatic`), so hearts fill from it after
// hydration (`src/components/wishlist-state.tsx`). It holds public slugs only,
// and the server treats it as untrusted input on every read.
//
// `readWishlistCookie` reads request cookies, so render callers must sit
// inside <Suspense>. `writeWishlistCookie` only works in Server Actions and
// Route Handlers; the sign-in hook in `src/lib/auth.ts` writes it through
// Better Auth instead.
import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { products, wishlistItems } from "@/db/schema";
import {
  MAX_WISHLIST,
  WISHLIST_COOKIE,
  WISHLIST_MAX_AGE,
  baseCookieOptions,
  isValidSlug,
  parseWishlist,
} from "@/lib/cookies";

export const wishlistCookieOptions = { ...baseCookieOptions, maxAge: WISHLIST_MAX_AGE };

export async function readWishlistCookie(): Promise<string[]> {
  return parseWishlist((await cookies()).get(WISHLIST_COOKIE)?.value);
}

export async function writeWishlistCookie(slugs: string[]) {
  const store = await cookies();
  if (slugs.length === 0) {
    store.delete(WISHLIST_COOKIE);
    return;
  }
  store.set(
    WISHLIST_COOKIE,
    JSON.stringify(slugs.slice(0, MAX_WISHLIST)),
    wishlistCookieOptions,
  );
}

// Most recently saved first. Uncached: it's per user.
export async function getUserWishlistSlugs(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(wishlistItems)
    .innerJoin(products, eq(wishlistItems.productId, products.id))
    .where(and(eq(wishlistItems.userId, userId), eq(products.status, "active")))
    .orderBy(desc(wishlistItems.createdAt), desc(products.id))
    .limit(MAX_WISHLIST);
  return rows.map((row) => row.slug);
}

// One statement: unknown slugs are skipped, pieces already saved are no-ops,
// and only as many as fit under the cap are added.
export async function addUserWishlist(userId: string, slugs: string[]) {
  const valid = slugs.filter(isValidSlug).slice(0, MAX_WISHLIST);
  if (valid.length === 0) return;

  await db.execute(sql`
    insert into ${wishlistItems} (user_id, product_id)
    select ${userId}, ${products.id}
    from ${products}
    where ${inArray(products.slug, valid)}
      and ${products.status} = 'active'
      and ${products.id} not in (
        select product_id from ${wishlistItems} where user_id = ${userId}
      )
    limit greatest(
      0,
      ${MAX_WISHLIST} - (select count(*) from ${wishlistItems} where user_id = ${userId})
    )
    on conflict do nothing
  `);
}

export async function removeUserWishlist(userId: string, slug: string) {
  await db
    .delete(wishlistItems)
    .where(
      and(
        eq(wishlistItems.userId, userId),
        inArray(
          wishlistItems.productId,
          db.select({ id: products.id }).from(products).where(eq(products.slug, slug)),
        ),
      ),
    );
}

export async function clearUserWishlist(userId: string) {
  await db.delete(wishlistItems).where(eq(wishlistItems.userId, userId));
}
