# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack

Next.js 16 (App Router, `src/`, Turbopack) · React 19 · Tailwind v4 (CSS-configured, no `tailwind.config`) · Drizzle ORM on Neon Postgres (`neon-http`) · Better Auth. Use **pnpm**. Import alias `@/*` → `src/*`.

## Layout

- `src/app` holds routes and Next special files only. Domain code (data access, Server Actions, the components that belong to one area) lives in `src/features/<area>` (`catalog`, `cart`, `checkout`, `orders`, `wishlist`, `restock-alerts`, `account`, `admin`). Features never import from `@/app`.
- `src/lib` is third-party setup (auth, Stripe, email, uploads, rate limits) and general helpers; `src/components` is shared UI (header, footer, icons, `signal`). `src/db` stays where it is because `drizzle-kit` and the `db:*` scripts can't resolve `@/`, which is also why `admin-event-kinds` and `field-changes` (imported by the schema) live in `src/lib`.

## Next 16 gotchas

- `cacheComponents` and `partialPrefetching` are on (`next.config.ts`). Dynamic data (cookies, headers, sessions, uncached DB reads) must sit inside `<Suspense>` or use `"use cache"`. Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before adding session checks.
- `middleware.ts` is deprecated; route interception goes in `src/proxy.ts`.
- `usePathname()` suspends under a dynamic segment without `generateStaticParams` (e.g. `/account/orders/[id]`), and that fails the build for any layout above it. Wrap only the part that reads it in `<Suspense>`, as `AccountNav` does for its active link.

## Database & auth

- `src/db/schema.ts` is the single source of truth: `db` (`src/db/index.ts`), the Better Auth Drizzle adapter (`src/lib/auth.ts`) and `drizzle-kit` all read it.
- The Better Auth tables (`user`, `session`, `account`, `verification`, plus the `role` column) are in the schema and migration `0001`; its `rate_limit` table is in `0004`. Re-run `pnpm dlx auth generate` only after changing auth plugins or fields, merge the diff by hand, then run `pnpm db:generate` + `pnpm db:migrate` (or `pnpm db:push` for quick dev sync). Migrations go to `./drizzle`.
- Columns get explicit snake_case names (`integer("category_id")`); there is no `casing` option on `db`. The store is UK-based and sells in GBP (`STORE_CURRENCY`). Prices are integer pence, and `formatPrice` in `src/features/catalog/catalog.ts` divides by 100 (whole pounds drop the `.00`; pence always show). Pass an order's own `currency` when showing it: early orders were taken in USD.
- Product reads go through `src/features/catalog/products.ts` only. Each query uses `"use cache"` + `cacheLife` + `cacheTag("products")`, so they belong in the static shell rather than in `<Suspense>`. Mutations should call `updateTag("products")`.
- Products have a `status`: `draft` (new products start here), `active` or `archived`. Every storefront read (`selectProducts`, the bag, checkout, wishlist, restock alerts) only sees `active`; keep that true for any new read. `published_at` is set the first time a product goes live.
- `src/features/catalog/catalog.ts` is editorial content and pure helpers only; don't put product data back in it. Sample products live in `src/db/seed.ts` (`pnpm db:seed`). The seed upserts on `slug`, so add new seed data the same way.
- `pnpm build` queries the DB (`/products/[slug]` uses `generateStaticParams` + `ensureStatic = "navigation"`, which needs at least one product), so migrate and seed before building.
- Server code reads the session through `src/lib/session.ts` (`getCurrentUser`, `requireUser`, `requireAdmin`, `assertAdmin`), never `auth.api` directly; client code uses `authClient` from `src/lib/auth-client.ts`. The HTTP handler lives at `src/app/api/auth/[...all]/route.ts`. Sign-in return paths (`?from=`, `?next=`) always go through `safeRedirectPath` (`src/lib/redirect.ts`).
- Sessions last 30 days. Password and name limits and the email check live in `src/features/account/account-fields.ts`, shared by the forms and Better Auth. There's no forgot-password flow yet.
- On Vercel, Better Auth takes its base URL from the request host, limited to the deployment's own URLs (`vercelAuthHosts` in `src/lib/app-url.ts`), so previews can sign in. Locally `BETTER_AUTH_URL` is the one origin.

## Cart

- The bag is cookie-only (no table): an httpOnly `cart` cookie of `{ slug, quantity }` pairs, read and written through `src/features/cart/cart.ts`. Never store prices or names in it; `getCartProducts` in `src/features/catalog/products.ts` reads them fresh and is deliberately uncached, so render its callers inside `<Suspense>`.
- Mutations are the Server Actions in `src/features/cart/actions.ts`. They need no session, treat every argument and the cookie as untrusted, and clamp quantities to live stock and `MAX_QUANTITY`. Adding to the bag doesn't reserve stock; checkout does (below).
- `/products/[slug]` and `/collections/[slug]` are `ensureStatic = "navigation"`, so the shared header can't read cookies on the server. Its nav and the home page's category tiles come from `getCategories()` / `getCategoryTiles()` (cached), never hard-coded slugs, and collection sorting is client-side (`SortableProductGrid`). The bag badge reads a display-only `cart_count` cookie on the client (`src/features/cart/bag-count.tsx`). Client code that calls a cart action must call `notifyCartChange()` afterwards.
- `/search` with no query is the shop-all page.

## Wishlist

- Guests save to a `wishlist` cookie of slugs; signed-in users save to `wishlist_items`, and the same cookie mirrors their list. Helpers live in `src/features/wishlist/wishlist.ts`, actions in `src/features/wishlist/actions.ts`, and `parseWishlist` in `src/lib/cookies.ts`, which the server and the client hearts share.
- The cookie is deliberately not httpOnly: hearts on `ensureStatic` pages fill from it on the client (`src/features/wishlist/wishlist-state.tsx`). It holds public slugs only, and the server re-validates it on every read and never trusts it.
- A Better Auth `hooks.after` in `src/lib/auth.ts` merges the guest's cookie into the account on sign-in/sign-up and rewrites the cookie from the DB. Sign-out clears it client-side.
- Client code that calls a wishlist action must call `notifyWishlistChange()` afterwards. Capped at `MAX_WISHLIST` (50).

## Checkout & orders

- Stripe-hosted Checkout, guests or signed in. `startCheckout` (`src/features/checkout/actions.ts`) re-prices the bag from the DB, then in one `db.batch` creates a `pending` order with item snapshots and decrements stock, then creates the Checkout Session (inline `price_data`; there's no Stripe product catalog). Never take prices or payment status from the client.
- `neon-http` has no `db.transaction()`. Multi-step writes are one `db.batch` or one SQL statement; `products_stock_check` is what stops overselling.
- Customer order reads are `getUserOrders` / `getUserOrder` in `src/features/orders/orders.ts`. Ownership is a `WHERE user_id` in the query, never a check after fetching, and a miss is `notFound()` so ids can't be probed. Customers only see orders completed on Stripe (paid, or with a shipping address); abandoned, canceled and expired checkouts stay hidden.
- Order writes live in `src/features/orders/orders.ts`. Status changes only happen `WHERE status = 'pending'`, and releasing stock is in the same statement, so duplicate Stripe events are no-ops. `stripe_events` records event ids that have been handled.
- `src/app/api/stripe/webhook/route.ts`: `completed`/`async_payment_succeeded` → `paid` (only if `payment_status` is paid, `amount_subtotal` matches the order's subtotal, the total is that plus the chosen shipping, and the currency matches; the shipping and final total are recorded on the order); `expired`/`async_payment_failed` → release stock (`releaseSessionOrder`, then restock alerts). `/checkout/return` (Route Handler) syncs the session from Stripe server-side and clears the bag. Use `revalidateTag("products", { expire: 0 })` in Route Handlers, `updateTag` in actions.
- Sessions expire after 31 minutes, so abandoned checkouts hold stock that long. A browser holds one checkout at a time through the httpOnly `pending_checkout` cookie (`src/features/checkout/pending-checkout.ts`): `/checkout/cancel` (back on Stripe) and the next `startCheckout` release it straight away (`cancelCheckout`), and the bag counts its held pieces as the shopper's own (`creditHeldStock`) or settles one placed without a return to `/checkout/return` (`settleCheckout`).
- Holds the webhook never releases (no session created, missed webhook) are settled by `releaseLapsedHolds` in `src/features/checkout/order-sweep.ts`: lazily after `startCheckout` (`lazyReleaseLapsedHolds`, at most every 5 minutes per instance) and by `GET /api/cron/release-holds` with `Authorization: Bearer $CRON_SECRET`. Schedule that route every 5–15 minutes (there's no `vercel.json` yet). It also sends due restock alerts and prunes `stripe_events` and sent alerts after 30 days and rate-limit windows after a day. The Stripe client has a 10s timeout and one retry.
- Stripe return URLs and email links use `getAppUrl()` (`src/lib/app-url.ts`): `APP_URL`, except that a Vercel preview links to itself, where its cookies are.
- Per-IP limits (`consumeRateLimit(scope, limit)` in `src/lib/rate-limit.ts`, `checkout_rate_limits` table) cover `startCheckout`, order lookups and restock alerts. Better Auth's own limiter uses `storage: "database"` (`rate_limit` table); don't share it, because Better Auth deletes rows older than its own short windows.
- `/checkout/success` shows the address, email and items only to the signed-in owner or the browser holding the `checkout_receipt` cookie set by `/checkout/return`.
- Local webhooks: the `stripe listen` command is in the README.

## Email & accounts

- Mail goes through `sendEmail` / `trySendEmail` and `composeEmail` in `src/lib/email.ts` (Resend). Without `RESEND_API_KEY` and `EMAIL_FROM` it prints to the console in development and logs an error in production (`canSendEmail()` is false there). Send after the response (`after()`, or Better Auth's `backgroundTasks`, which is wired to `after`), so timing doesn't reveal whether an account or order exists. `CLIENT_SERVICES_EMAIL` (`src/features/catalog/catalog.ts`, set from the env var of that name at build time) is the contact address and reply-to; `/help/contact` shows it.
- Email verification is soft: sign-up sends a link (`callbackURL` `/account?verified=1`) and the account pages nudge until it's clicked (`EmailVerificationNotice`). `afterEmailVerification`, and sign-in for verified users, call `claimGuestOrders`, which moves guest orders with that email into the account. Never claim orders by an unverified email.
- `/account/details` changes name, email (Better Auth `changeEmail`: the link goes to the new address), password (revokes other sessions) and deletes the account (customers only; `beforeDelete` refuses admins). Orders survive deletion with `user_id` null.
- Guests find orders at `/orders/lookup` (reference + email). `requestOrderLink` always gives the same reply and emails a signed 72-hour link (`src/features/orders/order-link.ts`, HMAC keyed from `BETTER_AUTH_SECRET`) to `/orders/view`. Only orders `isVisibleToCustomer` are found.
- Back-in-stock alerts (`restock_alerts`, `src/features/restock-alerts/restock-alerts.ts`) are asked for on sold-out product pages (`requestRestockAlert`). `sendRestockAlerts` claims due rows before sending, so concurrent callers never double-send. It runs after an admin restock or publish, after a hold is released (webhook or `/checkout/return`), and in the cron sweep. It claims nothing when production has no email configured, so alerts aren't lost.

## Delivery

- Zones, rates and countries live in `src/features/cart/shipping.ts`. Hosted Checkout can't reprice delivery for the address typed, so the shopper picks a country in the bag (httpOnly `delivery_country` cookie, default GB). `startCheckout` limits `allowed_countries` to that one country and offers its zone's rates, cheapest first, because Stripe preselects the first one and the bag's total assumes it.
- The bag says "Prices include VAT" for UK delivery and warns about import duties everywhere else. Nothing collects tax (no Stripe Tax).

## Admin

- `/admin` (products, stock, categories, orders, customers, activity) is for users with `role = 'admin'`. Grant it on `/admin/customers` (verified accounts only; it refuses your own role and demoting the last admin) or with `pnpm db:make-admin <email>` (`--revoke` to remove), which is the way in for the first admin. Hiding links isn't access control, and neither `proxy.ts` (cookie presence only) nor `admin/layout.tsx` (static shell) checks the role.
- Every admin page renders its data in an async component inside `<Suspense>` whose first line is `await requireAdmin("<path>")` (non-admins get a 404). Every admin Server Action starts with `await assertAdmin()` before reading input, then validates everything (`src/features/admin/product-form.ts`); bound ids are re-checked with `isValidId` (products, categories) or `isOrderId` (`src/lib/ids.ts`). List pages read `?page=` with `pageParam` (`src/features/admin/components/list-controls.tsx`).
- Admin reads (`getAdmin*` in `src/features/catalog/products.ts` / `src/features/orders/orders.ts` / `src/features/admin/customers.ts`) are uncached, so they're never shared through `"use cache"`. Writes are single statements next to them and actions call `updateTag("products")` (or `refresh()` when no product data changed).
- Every admin write records itself in `admin_events` through `writeWithEvent` (`src/features/admin/admin-events.ts`), which runs the write and the history insert as one statement and logs nothing when a compare-and-set misses. Pass the acting admin (`assertAdmin()` returns them) and a diff from `diffFields`. History shows on the product edit page and `/admin/activity`. Its change kinds are defined twice, `adminEventKind` (`src/lib/admin-event-kinds.ts`) and `adminEventKindWhere` (SQL), so keep the two in step. `pnpm db:make-admin` is the one write that skips the history.
- Stock is set with a compare-and-set (`setStockIfUnchanged`) so a stale form can't overwrite a checkout's reservation. Product details are a compare-and-set on `version`, which admin edits and status changes bump but stock moves don't (checkouts change stock constantly, and bump `updated_at`). Price changes over 50% need a second, confirmed save; the minimum price is 50p.
- Slugs can change only while `published_at` is null; after that, archive and re-create. Only non-active products no order includes can be deleted; ordered ones are archived. Category slug `new` is reserved for `/collections/new`.
- Orders are read-only: only Stripe moves their status. A paid session the order can't accept (amount mismatch, or after release) sets `orders.attention_reason`, which shows under "Needs attention" until an admin marks it resolved with a note.
- Product photos upload from the browser straight to Vercel Blob (`ImageField` → `/api/admin/uploads`, which only issues tokens to admins with a same-origin request). Without `BLOB_READ_WRITE_TOKEN` uploads are off and images must be Unsplash URLs; the token is needed at build time too, so `next.config.ts` allows the store's Blob host (the same derivation as `getUploadHost()`; keep them in step).
- Show dates with `src/lib/dates.ts`, which formats in UK time; servers run in UTC.

## Security headers

- `next.config.ts` sets the CSP and other headers. There's no `script-src` (it would need per-request nonces, which rule out the static shell). `form-action` allows only this site and `checkout.stripe.com`, so posting a form to any other origin needs an entry there.

## Signal colour

- Colour signals state on a small glyph and the copy stays ink, the way the saved wishlist heart fills rose. Use `SignalMessage` (inline) or `Notice` (hairline box) from `src/components/signal.tsx` with a `tone` (`success`, `warning`, `danger`, `info`) rather than `text-danger` and friends on text. For a dot before a short label (stock, order and product status, eyebrows) use `StatusDot` (`size` `sm` or `md`; tones add `change` and `muted`).
- The tones are raw tokens in `globals.css` (`--success`, `--warning`, `--danger`, `--change`, `--heart`) with lighter values under `.theme-inverse`/`.dark`. `SignalMessage` always renders its element so `role="status"` regions exist before the first message.

## Environment

Setup and the full list of variables are in the README Quick start and `.env.example`. The Stripe client is created lazily, so builds work without the Stripe keys. `src/db/index.ts` throws when it's imported without `DATABASE_URL`, so anything importing `db` or `auth` fails without it, including at build time.

## Git

- Every new piece of work gets its own branch off `main` (`feat/<topic>`, `fix/<topic>`), even when the session started on another feature branch. Never commit or push to a branch that already exists unless the user names that branch. Check `git branch --show-current` before the first commit.
- Only commit files you changed for the task; leave unrelated working-tree edits out.

## Checks

No formatter yet. Verify changes with `pnpm lint`, `pnpm typecheck` (no DB needed), `pnpm test` and `pnpm build`. Tests use `node:test` through `tsx` and live next to the code as `*.test.ts`; they run with the `react-server` condition so modules importing `server-only` load.

To check signed-in pages, create a throwaway customer with `POST /api/auth/sign-up/email` (send an `Origin` header). When cleaning up, delete their orders before the user: `orders.user_id` is `on delete set null`, so deleting the user first leaves orphaned orders behind.
