"use server";

import { addToCart } from "@/features/cart/actions";
import { MAX_WISHLIST, isValidSlug } from "@/lib/cookies";
import { getCartProducts } from "@/features/catalog/products";
import { getCurrentUser } from "@/lib/session";
import {
  addUserWishlist,
  clearUserWishlist,
  getUserWishlistSlugs,
  readWishlistCookie,
  removeUserWishlist,
  writeWishlistCookie,
} from "@/features/wishlist/wishlist";

// Guests can save too, so these don't require a session: signed-in users write
// to the database, guests to the cookie. Every argument and the cookie are
// untrusted. Each action ends by rewriting the cookie, which the hearts read.

// `saved` is whether the piece is in the wishlist afterwards.
export type WishlistActionResult = { ok: boolean; saved: boolean; message: string };

const failed = (saved = false): WishlistActionResult => ({
  ok: false,
  saved,
  message: "Something went wrong. Please try again.",
});

// The guest's cookie with deleted products dropped, plus whether `slug`
// still exists.
async function loadGuestWishlist(slug?: string) {
  const stored = await readWishlistCookie();
  const slugs = slug && !stored.includes(slug) ? [...stored, slug] : stored;
  const live = new Set((await getCartProducts(slugs)).map((product) => product.slug));
  return {
    slugs: stored.filter((saved) => live.has(saved)),
    exists: slug ? live.has(slug) : false,
  };
}

async function syncCookie(userId: string) {
  const slugs = await getUserWishlistSlugs(userId);
  await writeWishlistCookie(slugs);
  return slugs;
}

export async function toggleWishlist(slug: string): Promise<WishlistActionResult> {
  if (!isValidSlug(slug)) return failed();
  const user = await getCurrentUser();

  if (user) {
    const current = await getUserWishlistSlugs(user.id);
    if (current.includes(slug)) {
      await removeUserWishlist(user.id, slug);
      await syncCookie(user.id);
      return { ok: true, saved: false, message: "Removed from your wishlist." };
    }
    if (current.length >= MAX_WISHLIST) {
      await writeWishlistCookie(current);
      return { ok: false, saved: false, message: "Your wishlist is full. Remove a piece to save another." };
    }
    await addUserWishlist(user.id, [slug]);
    const saved = (await syncCookie(user.id)).includes(slug);
    return saved
      ? { ok: true, saved, message: "Saved to your wishlist." }
      : { ok: false, saved, message: "This piece is no longer available." };
  }

  const { slugs, exists } = await loadGuestWishlist(slug);
  if (slugs.includes(slug)) {
    await writeWishlistCookie(slugs.filter((saved) => saved !== slug));
    return { ok: true, saved: false, message: "Removed from your wishlist." };
  }
  if (!exists) {
    await writeWishlistCookie(slugs);
    return { ok: false, saved: false, message: "This piece is no longer available." };
  }
  if (slugs.length >= MAX_WISHLIST) {
    await writeWishlistCookie(slugs);
    return { ok: false, saved: false, message: "Your wishlist is full. Remove a piece to save another." };
  }
  await writeWishlistCookie([slug, ...slugs]);
  return { ok: true, saved: true, message: "Saved to your wishlist." };
}

export async function removeFromWishlist(slug: string): Promise<WishlistActionResult> {
  if (!isValidSlug(slug)) return failed(true);
  const user = await getCurrentUser();

  if (user) {
    await removeUserWishlist(user.id, slug);
    await syncCookie(user.id);
  } else {
    const { slugs } = await loadGuestWishlist();
    await writeWishlistCookie(slugs.filter((saved) => saved !== slug));
  }
  return { ok: true, saved: false, message: "Removed from your wishlist." };
}

export async function clearWishlist(): Promise<WishlistActionResult> {
  const user = await getCurrentUser();
  if (user) await clearUserWishlist(user.id);
  await writeWishlistCookie([]);
  return { ok: true, saved: false, message: "Your wishlist is empty." };
}

// Only leaves the wishlist once it's in the bag, so a sold-out piece stays saved.
export async function moveToBag(slug: string): Promise<WishlistActionResult> {
  if (!isValidSlug(slug)) return failed(true);

  const added = await addToCart(slug);
  if (!added?.ok) {
    return { ok: false, saved: true, message: added?.message ?? failed().message };
  }
  await removeFromWishlist(slug);
  return { ok: true, saved: false, message: "Moved to your bag." };
}
