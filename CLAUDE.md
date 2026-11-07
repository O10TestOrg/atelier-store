# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack

Next.js 16 (App Router, `src/`, Turbopack) · React 19 · Tailwind v4 (CSS-configured, no `tailwind.config`) · Drizzle ORM on Neon Postgres (`neon-http`) · Better Auth. Use **pnpm**. Import alias `@/*` → `src/*`.

## Next 16 gotchas

- `cacheComponents` and `partialPrefetching` are on (`next.config.ts`). Dynamic data (cookies, headers, sessions, uncached DB reads) must sit inside `<Suspense>` or use `"use cache"`. Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before adding session checks.
- `middleware.ts` is deprecated; route interception goes in `src/proxy.ts`.

## Database & auth

- `src/db/schema.ts` is the single source of truth: `db` (`src/db/index.ts`), the Better Auth Drizzle adapter (`src/lib/auth.ts`) and `drizzle-kit` all read it.
- Better Auth tables (`user`, `session`, `account`, `verification`) don't exist yet. Generate them into the schema with `pnpm dlx auth generate`, then run `pnpm db:generate` + `pnpm db:migrate` (or `pnpm db:push` for quick dev sync). Migrations go to `./drizzle`.
- Columns get explicit snake_case names (`integer("category_id")`); there is no `casing` option on `db`. Prices are integer cents, and `formatPrice` in `src/lib/catalog.ts` divides by 100.
- Product reads go through `src/lib/products.ts` only. Each query uses `"use cache"` + `cacheLife` + `cacheTag("products")`, so they belong in the static shell rather than in `<Suspense>`. Mutations should call `updateTag("products")`.
- `src/lib/catalog.ts` is editorial content and pure helpers only; don't put product data back in it. Sample products live in `src/db/seed.ts` (`pnpm db:seed`). The seed upserts on `slug`, so add new seed data the same way.
- `pnpm build` queries the DB (`/products/[slug]` uses `generateStaticParams` + `ensureStatic = "navigation"`, which needs at least one product), so migrate and seed before building.
- Server code calls `auth.api.*` directly; client code uses `authClient` from `src/lib/auth-client.ts`. The HTTP handler lives at `src/app/api/auth/[...all]/route.ts`.

## Cart

- The bag is cookie-only (no table): an httpOnly `cart` cookie of `{ slug, quantity }` pairs, read and written through `src/lib/cart.ts`. Never store prices or names in it; `getCartProducts` in `src/lib/products.ts` reads them fresh and is deliberately uncached, so render its callers inside `<Suspense>`.
- Mutations are the Server Actions in `src/app/bag/actions.ts`. They need no session, treat every argument and the cookie as untrusted, and clamp quantities to live stock and `MAX_QUANTITY`. Stock is not reserved; decrement it atomically at checkout.
- `/products/[slug]` and `/collections/[slug]` are `ensureStatic = "navigation"`, so the shared header can't read cookies on the server. The bag badge reads a display-only `cart_count` cookie on the client (`src/components/bag-count.tsx`). Client code that calls a cart action must call `notifyCartChange()` afterwards.

## Environment

Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL`. `src/db/index.ts` throws when it's imported without `DATABASE_URL`, so anything importing `db` or `auth` fails without it, including at build time.

## Checks

No test framework or formatter yet. Verify changes with `pnpm lint` and `pnpm build`.
