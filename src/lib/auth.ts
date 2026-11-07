import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  WISHLIST_COOKIE,
  addUserWishlist,
  getUserWishlistSlugs,
  parseWishlist,
  wishlistCookieOptions,
} from "@/lib/wishlist";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // `input: false` keeps clients from choosing their own role at sign-up.
      // Promote admins with `pnpm db:make-admin <email>`.
      role: {
        type: ["customer", "admin"],
        required: false,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // On by default in production only; explicit so dev behaves the same.
  rateLimit: { enabled: true },
  hooks: {
    // Merges what a guest saved into the account they sign in or up to, then
    // rewrites the cookie from the account, so pieces saved elsewhere show too.
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      if (!ctx.path.startsWith("/sign-in") && !ctx.path.startsWith("/sign-up")) return;

      const userId = newSession.user.id;
      await addUserWishlist(userId, parseWishlist(ctx.getCookie(WISHLIST_COOKIE)));
      const slugs = await getUserWishlistSlugs(userId);
      ctx.setCookie(
        WISHLIST_COOKIE,
        JSON.stringify(slugs),
        slugs.length > 0 ? wishlistCookieOptions : { ...wishlistCookieOptions, maxAge: 0 },
      );
    }),
  },
  // Must stay last so it can set cookies from Server Actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
