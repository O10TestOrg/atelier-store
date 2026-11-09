# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack

Next.js 16 (App Router, `src/`, Turbopack) · React 19 · Tailwind v4 (CSS-configured, no `tailwind.config`) · Drizzle ORM on Neon Postgres (`neon-http`) · Better Auth. Use **pnpm**. Import alias `@/*` → `src/*`.

## Next 16 gotchas

- `cacheComponents` and `partialPrefetching` are on (`next.config.ts`). Dynamic data (cookies, headers, sessions, uncached DB reads) must sit inside `<Suspense>` or use `"use cache"`. Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before adding session checks.
- `middleware.ts` is deprecated; route interception goes in `src/proxy.ts`.
- `usePathname()` suspends under a dynamic segment without `generateStaticParams` (e.g. `/account/orders/[id]`), and that fails the build for any layout above it. Wrap only the part that reads it in `<Suspense>`, as `AccountNav` does for its active link.

## Database & auth

- `src/db/schema.ts` is the single source of truth: `db` (`src/db/index.ts`), the Better Auth Drizzle adapter (`src/lib/auth.ts`) and `drizzle-kit` all read it.
- The Better Auth tables (`user`, `session`, `account`, `verification`, plus the `role` column) are in the schema and migration `0001`. Re-run `pnpm dlx auth generate` only after changing auth plugins or fields, merge the diff by hand, then run `pnpm db:generate` + `pnpm db:migrate` (or `pnpm db:push` for quick dev sync). Migrations go to `./drizzle`.
- Columns get explicit snake_case names (`integer("category_id")`); there is no `casing` option on `db`. The store is UK-based and sells in GBP (`STORE_CURRENCY`). Prices are integer pence, and `formatPrice` in `src/lib/catalog.ts` divides by 100 (whole pounds drop the `.00`; pence always show). Pass an order's own `currency` when showing it: early orders were taken in USD.
- Product reads go through `src/lib/products.ts` only. Each query uses `"use cache"` + `cacheLife` + `cacheTag("products")`, so they belong in the static shell rather than in `<Suspense>`. Mutations should call `updateTag("products")`.
- Products have a `status`: `draft` (new products start here), `active` or `archived`. Every storefront read (`selectProducts`, the bag, checkout, wishlist, restock alerts) only sees `active`; keep that true for any new read. `published_at` is set the first time a product goes live.
- `src/lib/catalog.ts` is editorial content and pure helpers only; don't put product data back in it. Sample products live in `src/db/seed.ts` (`pnpm db:seed`). The seed upserts on `slug`, so add new seed data the same way.
- `pnpm build` queries the DB (`/products/[slug]` uses `generateStaticParams` + `ensureStatic = "navigation"`, which needs at least one product), so migrate and seed before building.
- Server code reads the session through `src/lib/session.ts` (`getCurrentUser`, `requireUser`, `requireAdmin`, `assertAdmin`), never `auth.api` directly; client code uses `authClient` from `src/lib/auth-client.ts`. The HTTP handler lives at `src/app/api/auth/[...all]/route.ts`.

## Cart

- The bag is cookie-only (no table): an httpOnly `cart` cookie of `{ slug, quantity }` pairs, read and written through `src/lib/cart.ts`. Never store prices or names in it; `getCartProducts` in `src/lib/products.ts` reads them fresh and is deliberately uncached, so render its callers inside `<Suspense>`.
- Mutations are the Server Actions in `src/app/bag/actions.ts`. They need no session, treat every argument and the cookie as untrusted, and clamp quantities to live stock and `MAX_QUANTITY`. Adding to the bag doesn't reserve stock; checkout does (below).
- `/products/[slug]` and `/collections/[slug]` are `ensureStatic = "navigation"`, so the shared header can't read cookies on the server. Its nav and the home page's category tiles come from `getCategories()` / `getCategoryTiles()` (cached), never hard-coded slugs; the mobile menu and the Collections dropdown (`HeaderMenu`) close on link tap, Escape, outside click and path change. Collection sorting is client-side (`SortableProductGrid`) for the same reason. The bag badge reads a display-only `cart_count` cookie on the client (`src/components/bag-count.tsx`). Client code that calls a cart action must call `notifyCartChange()` afterwards.

## Wishlist

- Guests save to a `wishlist` cookie of slugs; signed-in users save to `wishlist_items`, and the same cookie mirrors their list. Helpers live in `src/lib/wishlist.ts`, actions in `src/app/wishlist/actions.ts`.
- The cookie is deliberately not httpOnly: hearts on `ensureStatic` pages fill from it on the client (`src/components/wishlist-state.tsx`). It holds public slugs only, and the server re-validates it on every read and never trusts it.
- A Better Auth `hooks.after` in `src/lib/auth.ts` merges the guest's cookie into the account on sign-in/sign-up and rewrites the cookie from the DB. Sign-out clears it client-side.
- Client code that calls a wishlist action must call `notifyWishlistChange()` afterwards. Capped at `MAX_WISHLIST` (50).

## Checkout & orders

- Stripe-hosted Checkout, guests or signed in. `startCheckout` (`src/app/checkout/actions.ts`) re-prices the bag from the DB, then in one `db.batch` creates a `pending` order with item snapshots and decrements stock, then creates the Checkout Session (inline `price_data`; there's no Stripe product catalog). Never take prices or payment status from the client.
- `neon-http` has no `db.transaction()`. Multi-step writes are one `db.batch` or one SQL statement; `products_stock_check` is what stops overselling.
- Customer order reads are `getUserOrders` / `getUserOrder` in `src/lib/orders.ts`. Ownership is a `WHERE user_id` in the query, never a check after fetching, and a miss is `notFound()` so ids can't be probed. Customers only see orders completed on Stripe (paid, or with a shipping address); abandoned, canceled and expired checkouts stay hidden.
- Order writes live in `src/lib/orders.ts`. Status changes only happen `WHERE status = 'pending'`, and releasing stock is in the same statement, so duplicate Stripe events are no-ops. `stripe_events` records event ids that have been handled.
- `src/app/api/stripe/webhook/route.ts`: `completed`/`async_payment_succeeded` → `paid` (only if `payment_status` is paid, `amount_subtotal` matches the order's subtotal, the total is that plus the chosen shipping, and the currency matches; the shipping and final total are recorded on the order); `expired`/`async_payment_failed` → release stock. `/checkout/return` (Route Handler) syncs the session from Stripe server-side and clears the bag. Use `revalidateTag("products", { expire: 0 })` in Route Handlers, `updateTag` in actions.
- Sessions expire after 31 minutes, so abandoned checkouts hold stock that long. Clicking back on Stripe hits `/checkout/cancel`, which expires the session and releases stock immediately. It only acts when the httpOnly `pending_checkout` cookie (`src/lib/pending-checkout.ts`, path `/`) matches the order. `startCheckout` releases that cookie's previous checkout the same way (`cancelCheckout` in `src/lib/order-sweep.ts`), so a browser holds one checkout at a time. The cookie lasts 7 days, longer than the hold. `readBrowserCheckout` tells the bag whether that checkout is still holding stock (the bag and bag actions count it as available through `creditHeldStock`) or was placed without a return to `/checkout/return` (the bag calls `settleCheckout`, which takes the bought pieces out of the bag).
- Holds the webhook never releases (no session created, missed webhook) are settled by `releaseLapsedHolds` in `src/lib/order-sweep.ts`: lazily after `startCheckout` (at most every 5 minutes per instance) and by `GET /api/cron/release-holds` with `Authorization: Bearer $CRON_SECRET` (schedule it every 5–15 minutes; it also prunes `stripe_events` after 30 days). The Stripe client has a 15s timeout.
- `startCheckout` is rate-limited per IP (`src/lib/checkout-limit.ts`, `checkout_rate_limits` table). Better Auth's own limiter uses `storage: "database"` (`rate_limit` table); don't share it, because Better Auth deletes rows older than its own short windows.
- `/checkout/success` shows the address, email and items only to the signed-in owner or the browser holding the `checkout_receipt` cookie set by `/checkout/return`.
- Local webhooks: `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook` (newer CLIs require `--events`).

## Email & accounts

- Mail goes through `sendEmail` / `trySendEmail` and `composeEmail` in `src/lib/email.ts` (Resend). Without `RESEND_API_KEY` and `EMAIL_FROM` it prints to the console in development and logs an error in production. Send after the response (`after()`, or Better Auth's `backgroundTasks`, which is wired to `after`), so timing doesn't reveal whether an account or order exists. `CLIENT_SERVICES_EMAIL` in `src/lib/catalog.ts` is the contact address and reply-to; `/help/contact` shows it.
- Email verification is soft: sign-up sends a link (`callbackURL` `/account?verified=1`) and the account pages nudge until it's clicked (`EmailVerificationNotice`). `afterEmailVerification`, and sign-in for verified users, call `claimGuestOrders`, which moves guest orders with that email into the account. Never claim orders by an unverified email.
- `/account/details` changes name, email (Better Auth `changeEmail`: the link goes to the new address), password (revokes other sessions) and deletes the account (customers only; `beforeDelete` refuses admins). Orders survive deletion with `user_id` null.
- Guests find orders at `/orders/lookup` (reference + email). `requestOrderLink` always gives the same reply and emails a signed 72-hour link (`src/lib/order-link.ts`, HMAC keyed from `BETTER_AUTH_SECRET`) to `/orders/view`. Only orders `isVisibleToCustomer` are found.
- Back-in-stock alerts (`restock_alerts`, `src/lib/restock-alerts.ts`) are asked for on sold-out product pages (`requestRestockAlert`). `sendRestockAlerts` claims due rows before sending, so concurrent callers never double-send. It runs after an admin restock, after the webhook releases a hold, and in the cron sweep, which also prunes sent rows after 30 days.
- The per-IP limiter in `src/lib/checkout-limit.ts` (`consumeRateLimit(scope, limit)`) also covers order lookups and restock alerts.

## Delivery

- Zones, rates and countries live in `src/lib/shipping.ts`. Hosted Checkout can't reprice delivery for the address typed, so the shopper picks a country in the bag (httpOnly `delivery_country` cookie, default GB). `startCheckout` limits `allowed_countries` to that one country and offers its zone's rates, cheapest first, because Stripe preselects the first one and the bag's total assumes it.
- The bag says "Prices include VAT" for UK delivery and warns about import duties everywhere else. Nothing collects tax (no Stripe Tax).

## Admin

- `/admin` (products, stock, categories, orders, customers, activity) is for users with `role = 'admin'`. Grant it on `/admin/customers` (verified accounts only; it refuses your own role and demoting the last admin) or with `pnpm db:make-admin <email>` (`--revoke` to remove), which is the way in for the first admin. Hiding links isn't access control, and neither `proxy.ts` (cookie presence only) nor `admin/layout.tsx` (static shell) checks the role.
- Every admin page renders its data in an async component inside `<Suspense>` whose first line is `await requireAdmin("<path>")` (non-admins get a 404). Every admin Server Action starts with `await assertAdmin()` before reading input, then validates everything (`src/lib/product-form.ts`); bound ids are re-checked with `isValidId`.
- Admin reads (`getAdmin*` in `src/lib/products.ts` / `src/lib/orders.ts` / `src/lib/customers.ts`) are uncached, so they're never shared through `"use cache"`. Writes are single statements next to them and actions call `updateTag("products")` (or `refresh()` when no product data changed).
- Every admin write records itself in `admin_events` through `writeWithEvent` (`src/lib/admin-events.ts`), which runs the write and the history insert as one statement and logs nothing when a compare-and-set misses. Pass the acting admin (`assertAdmin()` returns them) and a diff from `diffFields`. History shows on the product edit page and `/admin/activity`.
- Stock is set with a compare-and-set (`setStockIfUnchanged`) so a stale form can't overwrite a checkout's reservation. Product details are a compare-and-set on `version`, which admin edits and status changes bump but stock moves don't (checkouts change stock constantly, and bump `updated_at`). Price changes over 50% need a second, confirmed save; the minimum price is 50p.
- Slugs can change only while `published_at` is null; after that, archive and re-create. Only non-active products no order includes can be deleted; ordered ones are archived. Category slug `new` is reserved for `/collections/new`.
- Orders are read-only: only Stripe moves their status. A paid session the order can't accept (amount mismatch, or after release) sets `orders.attention_reason`, which shows under "Needs attention" until an admin marks it resolved with a note.
- Product photos upload from the browser straight to Vercel Blob (`ImageField` → `/api/admin/uploads`, which only issues tokens to admins with a same-origin request). Without `BLOB_READ_WRITE_TOKEN` uploads are off and images must be Unsplash URLs; the token is needed at build time too, so `next.config.ts` allows the store's Blob host.

## Signal colour

- Colour signals state on a small glyph and the copy stays ink, the way the saved wishlist heart fills rose. Use `SignalMessage` (inline) or `Notice` (hairline box) from `src/components/signal.tsx` with a `tone` (`success`, `warning`, `danger`, `info`) rather than `text-danger` and friends on text.
- The tones are raw tokens in `globals.css` (`--success`, `--warning`, `--danger`, `--heart`) with lighter values under `.theme-inverse`/`.dark`. `SignalMessage` always renders its element so `role="status"` regions exist before the first message.

## Environment

Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL`, plus `STRIPE_SECRET_KEY` (restricted `rk_` key from a sandbox), `STRIPE_WEBHOOK_SECRET` and `APP_URL` for checkout, `CRON_SECRET` for the hold sweep, and `RESEND_API_KEY` + `EMAIL_FROM` for email. The Stripe client is created lazily, so builds work without the Stripe keys. `src/db/index.ts` throws when it's imported without `DATABASE_URL`, so anything importing `db` or `auth` fails without it, including at build time.

## Git

- Every new piece of work gets its own branch off `main` (`feat/<topic>`, `fix/<topic>`), even when the session started on another feature branch. Never commit or push to a branch that already exists unless the user names that branch. Check `git branch --show-current` before the first commit.
- Only commit files you changed for the task; leave unrelated working-tree edits (such as a modified `.env.example`) out.

## Checks

No formatter yet. Verify changes with `pnpm lint`, `pnpm typecheck` (no DB needed), `pnpm test` and `pnpm build`. Tests use `node:test` through `tsx` and live next to the code as `*.test.ts`; they run with the `react-server` condition so modules importing `server-only` load.

To check signed-in pages, create a throwaway customer with `POST /api/auth/sign-up/email` (send an `Origin` header). When cleaning up, delete their orders before the user: `orders.user_id` is `on delete set null`, so deleting the user first leaves orphaned orders behind.
