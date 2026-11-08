# Atelier

An online store: catalogue, bag, wishlist, Stripe-hosted checkout, customer accounts and an admin area.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Drizzle ORM on Neon Postgres · Better Auth · Stripe. Use **pnpm**.

Conventions, architecture and gotchas are in [CLAUDE.md](CLAUDE.md). Read it before changing code.

## Quick start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:

   | Variable | What it is |
   | --- | --- |
   | `DATABASE_URL` | Neon Postgres connection string |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | The app's origin, e.g. `http://localhost:3000` |
   | `STRIPE_SECRET_KEY` | A restricted `rk_` key from a Stripe sandbox |
   | `STRIPE_WEBHOOK_SECRET` | Printed by `stripe listen` (below) |
   | `APP_URL` | The app's origin, used for Stripe return URLs |

3. Create the tables and load the sample catalogue:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. Start the dev server at <http://localhost:3000>:

   ```bash
   pnpm dev
   ```

`pnpm build` reads products from the database, so migrate and seed before building.

## Stripe webhooks in development

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Admin access

Sign up in the app, then give the account the admin role:

```bash
pnpm db:make-admin you@example.com
pnpm db:make-admin you@example.com --revoke   # remove it again
```

The admin area is at `/admin`.

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build or serve the app |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no database needed |
| `pnpm test` | Unit tests for the cart, price and redirect helpers |
| `pnpm db:generate` / `pnpm db:migrate` | Create and apply migrations from `src/db/schema.ts` |
| `pnpm db:push` | Sync the schema straight to the database (quick dev only) |
| `pnpm db:studio` | Browse the database |
| `pnpm db:seed` | Upsert the sample catalogue |
| `pnpm db:make-admin <email>` | Grant (or `--revoke`) the admin role |
