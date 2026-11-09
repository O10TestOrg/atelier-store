import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/features/account/account-fields";
import { vercelAuthHosts } from "@/lib/app-url";
import { WISHLIST_COOKIE, parseWishlist } from "@/lib/cookies";
import { composeEmail, sendEmail } from "@/lib/email";
import { claimGuestOrders } from "@/features/orders/orders";
import {
  addUserWishlist,
  getUserWishlistSlugs,
  wishlistCookieOptions,
} from "@/features/wishlist/wishlist";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment. On
// Vercel the base URL follows the request host, limited to this deployment's
// own URLs, so previews can sign in and their emails link back to themselves.
const allowedHosts = vercelAuthHosts();

export const auth = betterAuth({
  ...(allowedHosts && {
    baseURL: {
      allowedHosts,
      protocol: "https",
      fallback: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
    },
  }),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    autoSignIn: true,
  },
  // Soft verification: new accounts can sign in straight away, and the account
  // pages nudge until the link is clicked. A verified email is what lets guest
  // orders placed with it join the account.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        composeEmail({
          to: user.email,
          subject: "Confirm your email address",
          heading: "Confirm your email address",
          paragraphs: [
            `Hello ${user.name}, please confirm that this is your email address for your Atelier account.`,
            "Once it’s confirmed, any orders you placed as a guest with this address will appear in your account.",
          ],
          action: { label: "Confirm email address", url },
          footnote: "The link works for 24 hours. If you didn’t create an account, you can ignore this email.",
        }),
      );
    },
    // Also runs when a changed email is confirmed.
    afterEmailVerification: async (user) => {
      await claimGuestOrders(user.id, user.email);
    },
  },
  user: {
    // The new address must be confirmed from a link sent to it before it
    // replaces the old one.
    changeEmail: { enabled: true },
    deleteUser: {
      enabled: true,
      // Admins are demoted on /admin/customers (never the last one) before
      // their account can go, so the store can't lose its last admin here.
      beforeDelete: async (user) => {
        if ((user as { role?: string }).role === "admin") {
          throw new APIError("BAD_REQUEST", { message: "Admin accounts can't be deleted here." });
        }
      },
    },
    additionalFields: {
      // `input: false` keeps clients from choosing their own role at sign-up.
      // Admins grant it on /admin/customers; `pnpm db:make-admin <email>`
      // bootstraps the first one.
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
  // On by default in production only; explicit so dev behaves the same. Stored
  // in the `rate_limit` table so limits hold across server instances.
  rateLimit: {
    enabled: true,
    storage: "database",
    // Each of these sends an email or checks a password.
    customRules: {
      "/send-verification-email": { window: 60, max: 3 },
      "/change-email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 5 },
    },
  },
  // Emails are sent after the response, so sign-up doesn't wait on Resend and
  // its timing doesn't reveal whether an address has an account.
  advanced: { backgroundTasks: { handler: (task) => after(task) } },
  hooks: {
    // Merges what a guest saved into the account they sign in or up to, then
    // rewrites the cookie from the account, so pieces saved elsewhere show too.
    // Guest orders placed since the email was verified join the account here.
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      if (!ctx.path.startsWith("/sign-in") && !ctx.path.startsWith("/sign-up")) return;

      const userId = newSession.user.id;
      if (newSession.user.emailVerified) await claimGuestOrders(userId, newSession.user.email);
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
