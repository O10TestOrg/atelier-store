import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

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
  // Must stay last so it can set cookies from Server Actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
