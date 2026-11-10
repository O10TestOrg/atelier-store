# Atelier

> [!CAUTION]
> **This is an experimental demo, not a production-ready store.** I built it to try out AI-assisted development, taking inspiration from a video tutorial. Review it carefully before you use any of it in production.
>
> **How AI was used:** most of the code was written with [Claude Code](https://claude.com/claude-code), following a structured workflow rather than one-shot prompting:
>
> - The project rules, architecture and gotchas are written down in [CLAUDE.md](CLAUDE.md), and the agent works from them.
> - Agent skills guided specific areas: the official Better Auth and Neon skills, plus a project `build-ui` skill for storefront UI.
> - Each feature or fix went on its own branch and was merged through a pull request.
> - Audits of technical integrity, customer experience, features and docs produced numbered findings, which were then fixed in separate PRs.
> - Changes were verified with lint, type checks, tests and a production build.

An online fashion store for a UK boutique: browse the catalogue, save pieces, pay through Stripe-hosted Checkout as a guest or with an account, and run the shop from a built-in admin area.

![Next.js 16](https://img.shields.io/badge/Next.js-16.4-000000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19.3-149eca?logo=react)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-c5f74f?logo=drizzle)
![Neon Postgres](https://img.shields.io/badge/Neon-Postgres-00e599?logo=postgresql)
![Better Auth](https://img.shields.io/badge/Better_Auth-1.7-000000)
![Stripe](https://img.shields.io/badge/Stripe-Checkout-635bff?logo=stripe)
![pnpm](https://img.shields.io/badge/pnpm-12-f69220?logo=pnpm)

<p align="center">
  <img src="./docs/assets/demo.gif" alt="Browsing a collection, adding a bag to the bag and paying with a Stripe test card" width="960">
  <br>
  <em>From collection page to paid order in under a minute, using a Stripe test card.</em>
</p>

> [!NOTE]
> Conventions, architecture rules and gotchas for contributors live in [CLAUDE.md](CLAUDE.md). Read it before changing code.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing and quality checks](#testing-and-quality-checks)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Features

**For shoppers**

- Browse collections, "New arrivals" and a searchable shop-all page, with sorting.
- A bag that works without an account, with delivery to the UK, Europe and worldwide priced before checkout.
- Secure payment on Stripe-hosted Checkout. Stock is held for the shopper while they pay, so nothing oversells.
- A wishlist that works as a guest and merges into the account on sign-in.
- Back-in-stock emails for sold-out pieces.
- Accounts with order history, email verification, and changes to name, email and password, plus account deletion.
- Guest order lookup by order reference and email, with a signed 72-hour link sent by email.

**For the shop**

- An admin area for products (draft, active or archived), stock, categories, orders and customers.
- Photo uploads to Vercel Blob, or Unsplash URLs when uploads are off.
- A full activity history of every admin change.
- A "Needs attention" queue for payments that don't match their order.
- A scheduled sweep that releases stock from abandoned checkouts.

## Architecture

```mermaid
flowchart LR
    Browser["Browser"]

    subgraph App["Next.js 16 app (src/)"]
        Proxy["proxy.ts<br/>route interception"]
        Pages["Pages<br/>static shell + streamed parts"]
        Actions["Server Actions<br/>bag, wishlist, checkout, admin"]
        Routes["Route Handlers<br/>auth, webhook, cron, uploads"]
    end

    DB[("Neon Postgres<br/>via Drizzle ORM")]
    Auth["Better Auth<br/>sessions, accounts"]
    Stripe["Stripe<br/>hosted Checkout"]
    Resend["Resend<br/>email"]
    Blob["Vercel Blob<br/>product photos"]
    Cron["Scheduler<br/>e.g. Vercel Cron"]

    Browser --> Proxy --> Pages
    Browser --> Actions
    Pages --> DB
    Actions --> DB
    Actions --> Auth --> DB
    Actions -- "creates session" --> Stripe
    Browser -- "pays" --> Stripe
    Stripe -- "webhook events" --> Routes
    Routes --> DB
    Routes --> Resend
    Actions --> Resend
    Browser -- "direct upload" --> Blob
    Cron -- "GET /api/cron/release-holds" --> Routes
```

How a purchase flows:

1. The bag lives in an httpOnly cookie that holds only product slugs and quantities. Prices and names are always read fresh from the database.
2. `startCheckout` re-prices the bag, creates a `pending` order and reserves stock in one database batch, then sends the shopper to Stripe.
3. Stripe's webhook (or the shopper's return to `/checkout/return`) marks the order paid, but only if the amount and currency match. Expired or failed payments release the stock.
4. Holds Stripe never reports back on are released by the scheduled sweep.

## Prerequisites

| Dependency | Version | Needed for | Check with |
| --- | --- | --- | --- |
| [Node.js](https://nodejs.org/) | **20.9 or newer** (required by Next 16) | Everything | `node -v` |
| [pnpm](https://pnpm.io/) | **12.16.1** (pinned in `package.json`) | Installing and running scripts | `pnpm -v` |
| [Git](https://git-scm.com/) | Any recent | Cloning | `git --version` |
| [OpenSSL](https://www.openssl.org/) | Any | Generating secrets | `openssl version` |
| [Stripe CLI](https://docs.stripe.com/stripe-cli) | Any recent | Optional: forwarding webhooks locally | `stripe version` |

You'll also need these accounts:

| Service | Required | Used for |
| --- | --- | --- |
| [Neon](https://neon.tech/) | Yes | The Postgres database. The free tier is enough. |
| [Stripe](https://dashboard.stripe.com/) | For checkout | A sandbox for test payments. |
| [Resend](https://resend.com/) | Production only | Sending email. In development, emails print to the terminal. |
| [Vercel Blob](https://vercel.com/docs/vercel-blob) | Optional | Uploading product photos. |

The easiest way to get the pinned pnpm version is Corepack:

```bash
corepack enable
pnpm -v   # 12.16.1
```

> [!TIP]
> If `corepack` isn't found (newer Node releases no longer bundle it), install it first with `npm install -g corepack`.

There's no Docker setup. The app runs on Node, and the database is hosted on Neon.

## Quick start

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/O10TestOrg/atelier-store.git
   cd atelier-store
   pnpm install
   ```

2. Create your local env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in at least `DATABASE_URL`, `BETTER_AUTH_SECRET` and `CRON_SECRET` (see [Configuration](#configuration)). Generate each secret with:

   ```bash
   openssl rand -base64 32
   ```

4. Create the tables and load the sample catalogue (4 categories, 8 products):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

   Open <http://localhost:3000>.

6. Optional: to take test payments, add `STRIPE_SECRET_KEY` and forward webhooks (see [Stripe webhooks in development](#stripe-webhooks-in-development)).

7. Optional: to reach `/admin`, sign up in the app and promote your account (see [Admin access](#admin-access)).

> [!WARNING]
> `pnpm build` reads products from the database, so run `pnpm db:migrate` and `pnpm db:seed` before building, locally or in CI.

## Configuration

Next.js loads `.env.local`, then `.env`, from the project root. The `db:*` scripts load the same files, so run them from the root. Never commit `.env.local`. `.gitignore` already ignores every `.env*` file except `.env.example`.

| Variable | Required | Default | Description / where to get it |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | none | The Neon Postgres connection string, from the Neon dashboard → **Connect**. Anything that imports the database fails without it, including `pnpm build`. |
| `BETTER_AUTH_SECRET` | **Yes** | none | Signs sessions and guest order links. Generate it with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | **Yes** | `http://localhost:3000` | The app's origin. It must match the URL in your browser exactly, including the port. |
| `APP_URL` | **Yes** | `http://localhost:3000` | The public origin used in Stripe return URLs and email links. Vercel previews use their own URL instead. |
| `STRIPE_SECRET_KEY` | For checkout | none | A restricted `rk_` key from a Stripe sandbox with write access to Checkout Sessions, from Dashboard → Developers → API keys. Builds work without it. |
| `STRIPE_WEBHOOK_SECRET` | For checkout | none | The `whsec_` secret printed by `stripe listen` locally, or from the webhook endpoint in the Stripe Dashboard in production. |
| `CRON_SECRET` | In production | none | The bearer token for `/api/cron/release-holds`. Generate it with `openssl rand -base64 32`. Without it, the route stays closed. |
| `RESEND_API_KEY` | In production | none | A Resend API key. Leave it unset in development and emails print to the server terminal. |
| `EMAIL_FROM` | In production | none | A sender on a domain verified in Resend, e.g. `Atelier <orders@yourdomain.com>`. |
| `BLOB_READ_WRITE_TOKEN` | No | none | A Vercel Blob read-write token for photo uploads in `/admin`. **Read at build time**, so rebuild after setting it. Unset, uploads are off and images must be Unsplash URLs. |
| `CLIENT_SERVICES_EMAIL` | No | `clientservices@atelier.example` | The contact and reply-to address shown on `/help/contact` and in emails. **Read at build time.** |

<details>
<summary>A minimal <code>.env.local</code> for local development</summary>

```bash
DATABASE_URL="postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="paste-output-of-openssl-rand"
BETTER_AUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
CRON_SECRET="paste-output-of-openssl-rand"
# Add these to take test payments
STRIPE_SECRET_KEY="rk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

</details>

## Usage

### Shopping

1. Open a collection from the header, or browse everything at `/search`.
2. Open a product and choose **Add to bag**.
3. In the bag (`/bag`), pick the delivery country. The total includes the cheapest rate for that zone:

   | Zone | Rates |
   | --- | --- |
   | United Kingdom | Standard: free, 2–3 working days. Next working day: £15. |
   | Europe | Express: £25, 3–5 working days. |
   | Rest of world | Express: £45, 4–7 working days. Import duties may apply. |

4. Choose **Checkout** and pay on Stripe with the test card `4242 4242 4242 4242`, any future expiry date and any CVC.
5. You land on `/checkout/success` with the order summary.

<p align="center">
  <img src="./docs/assets/workflow-1-bag.png" alt="The bag with a delivery country selected and the total" width="960">
  <br>
  <em>The bag: line items, delivery country and the total before checkout.</em>
</p>

### Accounts and guest orders

- Sign up at `/sign-up`. In development, the verification link prints in the terminal running `pnpm dev`.
- Your orders are at `/account/orders`. Verifying your email moves any guest orders placed with that address into your account.
- Guests can find an order at `/orders/lookup` with the order reference and email. A signed link to it is emailed to them.

<p align="center">
  <img src="./docs/assets/workflow-2-account.png" alt="The account orders page listing a paid order" width="960">
  <br>
  <em>Order history in the account area.</em>
</p>

### Wishlist and restock alerts

- Tap the heart on any product. Guest wishlists merge into the account on sign-in (up to 50 items).
- On a sold-out product, enter an email to be told when it's back in stock.

### Admin access

Sign up in the app, then give the account the admin role:

```bash
pnpm db:make-admin you@example.com
pnpm db:make-admin you@example.com --revoke   # remove it again
```

Reload the page and open <http://localhost:3000/admin>.

| Page | What it's for |
| --- | --- |
| `/admin/products` | Create products (they start as drafts), edit them, publish or archive them, and set stock. |
| `/admin/categories` | Manage the collections shown in the header. |
| `/admin/orders` | View orders (read-only) and resolve anything under "Needs attention". |
| `/admin/customers` | View customers and grant or revoke admin (verified accounts only). |
| `/admin/activity` | Browse the history of every admin change. |

> [!NOTE]
> After the first admin, roles can also be changed on `/admin/customers`, which refuses to change your own role or demote the last admin. `pnpm db:make-admin` skips those rules, so use it to remove a compromised admin when nobody else can sign in.

To upload product photos instead of pasting Unsplash URLs, create a Vercel Blob store, set `BLOB_READ_WRITE_TOKEN`, and restart or rebuild.

<p align="center">
  <img src="./docs/assets/workflow-3-admin.png" alt="The admin product list with status and stock columns" width="960">
  <br>
  <em>The admin product list: status, stock and quick links to edit.</em>
</p>

### Stripe webhooks in development

Log in to the Stripe CLI once, then forward the four events the app handles:

```bash
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_` secret it prints into `STRIPE_WEBHOOK_SECRET`, then restart `pnpm dev`.

<details>
<summary>Expected output</summary>

```text
> Ready! You are using Stripe API Version [...]. Your webhook signing secret is whsec_... (^C to quit)
--> checkout.session.completed [evt_...]
<-- [200] POST http://localhost:3000/api/stripe/webhook [evt_...]
```

</details>

### Scheduled sweep

In production, call this route every 5–15 minutes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/release-holds
# {"released":0}
```

It releases stock held by checkouts Stripe never reported back on, sends due back-in-stock emails, and prunes old rows. Vercel Cron sends the `Authorization` header itself. There's no `vercel.json` yet, so add the schedule in your host's settings.

### Database scripts

| Script | What it does |
| --- | --- |
| `pnpm db:generate` | Creates a migration in `./drizzle` from changes to `src/db/schema.ts`. |
| `pnpm db:migrate` | Applies pending migrations. |
| `pnpm db:push` | Syncs the schema straight to the database. For quick local experiments only. |
| `pnpm db:studio` | Opens Drizzle Studio to browse the data. |
| `pnpm db:seed` | Upserts the sample catalogue. Safe to re-run. |
| `pnpm db:make-admin <email> [--revoke]` | Grants or removes the admin role. |

## Testing and quality checks

Run all four checks before opening a pull request:

```bash
pnpm lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
pnpm typecheck   # tsc --noEmit; needs no database
pnpm test        # Unit tests with node:test via tsx
pnpm build       # Production build; needs a migrated, seeded database
```

- Unit tests sit next to the code they test as `*.test.ts` (for example `src/features/cart/cart.test.ts`). They run with the `react-server` condition, so modules that import `server-only` load.
- To run one file: `pnpm exec tsx --conditions=react-server --test src/features/cart/cart.test.ts`.
- There's no end-to-end suite yet. If one is added, it belongs in a top-level `e2e/` folder.
- There's no formatter configured yet.

## Project structure

```text
atelier-store/
├── drizzle/                  # SQL migrations generated by drizzle-kit
├── src/
│   ├── app/                  # Routes only: pages, layouts and route handlers
│   │   ├── (auth)/           # /sign-in, /sign-up
│   │   ├── account/          # /account, order history, account details
│   │   ├── admin/            # /admin: products, categories, orders, customers, activity
│   │   ├── api/
│   │   │   ├── admin/uploads/    # Issues Vercel Blob upload tokens to admins
│   │   │   ├── auth/[...all]/    # Better Auth HTTP handler
│   │   │   ├── cron/release-holds/  # Scheduled sweep
│   │   │   └── stripe/webhook/   # Stripe events
│   │   ├── bag/  checkout/  collections/  orders/  products/  search/  wishlist/  help/
│   │   ├── layout.tsx  page.tsx  error.tsx  global-error.tsx  not-found.tsx
│   │   └── globals.css       # Tailwind v4 config and design tokens
│   ├── features/             # Domain code: data access, Server Actions, area components
│   │   ├── account/          # Auth forms, account details, email verification
│   │   ├── admin/            # Admin actions, form validation, event history, components/
│   │   ├── cart/             # Bag cookie, delivery zones, bag actions and UI
│   │   ├── catalog/          # Product queries, editorial content, product cards, search
│   │   ├── checkout/         # startCheckout, held-stock cookie, lapsed-hold sweep
│   │   ├── orders/           # Order reads and writes, signed order links, order UI
│   │   ├── restock-alerts/   # Back-in-stock requests and sending
│   │   └── wishlist/         # Wishlist cookie and table, hearts
│   ├── components/           # Shared UI: header, footer, icons, signal (status colours)
│   ├── lib/                  # Third-party setup and general helpers:
│   │                         # auth, session, stripe, email, uploads, rate limits, dates, ids
│   ├── db/
│   │   ├── schema.ts         # Single source of truth for every table
│   │   ├── index.ts          # Drizzle client (neon-http)
│   │   ├── seed.ts           # pnpm db:seed
│   │   └── make-admin.ts     # pnpm db:make-admin
│   └── proxy.ts              # Route interception (replaces middleware.ts in Next 16)
├── .env.example              # Every environment variable
├── drizzle.config.ts
├── next.config.ts            # Cache Components, image hosts, security headers
├── CLAUDE.md                 # Contributor conventions and architecture rules
└── package.json
```

The rule of thumb: routes in `src/app` stay thin and import from `@/features/*`. Features never import from `@/app`. `@/*` maps to `src/*`.

## Troubleshooting

### `Error: DATABASE_URL is not set`

**Cause:** Something imported the database client before the variable was set. This includes `pnpm build`, `pnpm dev` and the `db:*` scripts.

**Fix:** Put `DATABASE_URL` in `.env.local` in the project root and run commands from that folder. `pnpm typecheck` and `pnpm lint` don't need it.

### `pnpm build` fails on `/products/[slug]`

**Cause:** The product pages are prerendered and need at least one active product, but the database is empty or unmigrated.

**Fix:**

```bash
pnpm db:migrate
pnpm db:seed
pnpm build
```

### Port 3000 is already in use

**Fix:** Either stop the other process (`lsof -i :3000` shows it), or run on another port and update both origins to match:

```bash
pnpm dev --port 3001
```

```bash
# .env.local
BETTER_AUTH_URL="http://localhost:3001"
APP_URL="http://localhost:3001"
```

> [!WARNING]
> If `BETTER_AUTH_URL` doesn't match the address in your browser, sign-in and sign-up are rejected with an invalid-origin error.

### Checkout fails with `STRIPE_SECRET_KEY is not set`

**Fix:** Add a sandbox key to `.env.local` and restart `pnpm dev`. The Stripe client is created on first use, so the app builds and runs fine without it until someone checks out.

### Orders stay `pending` after paying locally

**Cause:** Stripe's events aren't reaching the app.

**Fix:** Run the `stripe listen` command from [Stripe webhooks in development](#stripe-webhooks-in-development), and make sure `STRIPE_WEBHOOK_SECRET` matches the secret it printed. Restart `pnpm dev` after editing `.env.local`. Returning to the site through `/checkout/return` also syncs the order.

### No verification or order emails arrive

**Cause:** In development without `RESEND_API_KEY` and `EMAIL_FROM`, emails aren't sent. Each message, link included, prints in the terminal running `pnpm dev`.

**Fix:** In production, both variables must be set and `EMAIL_FROM` must use a domain verified in Resend. Without them, the server logs `Email not sent` and back-in-stock alerts wait until email works.

### `/admin` shows a 404

**Cause:** Your account isn't an admin. Non-admins get a 404 rather than a redirect.

**Fix:** Run `pnpm db:make-admin you@example.com` with the email you signed up with, then reload.

### Image upload is missing in the admin, or an image URL is rejected

**Cause:** Uploads need `BLOB_READ_WRITE_TOKEN` at build time. Without it, only Unsplash images are allowed, and only in the exact `https://images.unsplash.com/photo-...?w=2400&q=80` form.

**Fix:** Set the token and restart `pnpm dev`, or rebuild for production.

### The cron route returns `401 Unauthorized`

**Fix:** Set `CRON_SECRET` on the server and send exactly `Authorization: Bearer <CRON_SECRET>`. If the variable is unset, the route stays closed.

### `pnpm install` says build scripts were ignored

This is expected. `pnpm-workspace.yaml` deliberately doesn't run the install scripts for `sharp`, `esbuild` and `unrs-resolver`, and nothing in the workflow above needs them.
