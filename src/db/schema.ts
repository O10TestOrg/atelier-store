// Better Auth tables were generated with `pnpm dlx auth generate`; re-run it
// after changing auth plugins or fields and merge the diff by hand.
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { adminEventAreas } from "../lib/admin-event-kinds";
import type { FieldChanges } from "../lib/field-changes";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

// Only `active` products are in the store. New ones start as `draft`;
// `archived` takes a product out of the store without losing its history.
export const productStatuses = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    reference: text("reference").notNull().unique(),
    name: text("name").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    // Minor units (pence).
    price: integer("price").notNull(),
    stock: integer("stock").notNull().default(0),
    image: text("image").notNull(),
    imageAlt: text("image_alt").notNull(),
    // Object position used to crop a close-up view from the main image.
    detailFocus: text("detail_focus").notNull().default("50% 50%"),
    isNew: boolean("is_new").notNull().default(false),
    colour: text("colour").notNull(),
    description: text("description").notNull(),
    details: text("details")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status", { enum: productStatuses }).notNull().default("draft"),
    // First time the product went live. Until then nobody can have it in a
    // bag or a link, so its slug can still change.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Bumped by every admin edit (not by stock moves, which checkouts make
    // constantly), so a form saved from a stale page can be refused.
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("products_category_id_idx").on(table.categoryId),
    index("products_status_idx").on(table.status),
    check("products_price_check", sql`${table.price} >= 0`),
    check(
      "products_status_check",
      sql`${table.status} in ('draft', 'active', 'archived')`,
    ),
    check("products_stock_check", sql`${table.stock} >= 0`),
  ],
);

// --- Better Auth -------------------------------------------------------------
// Model and field names must match what Better Auth expects; column names are ours.

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role", { enum: ["customer", "admin"] })
      .notNull()
      .default("customer"),
    ...timestamps,
  },
  (table) => [
    check("user_role_check", sql`${table.role} in ('customer', 'admin')`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Password hash for the "credential" provider; null for OAuth accounts.
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    ...timestamps,
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Auth rate limiting (`rateLimit.storage: "database"`), so limits hold across
// server instances. Better Auth prunes rows older than its longest window.
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  // Milliseconds since the epoch, as Better Auth stores it.
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// --- Orders ------------------------------------------------------------------
// One order per Stripe Checkout Session. Created `pending` at checkout start,
// in the same batch that reserves its stock; only Stripe (webhook or a
// server-side session read) moves it on. Reads and writes go through
// `src/features/orders/orders.ts`.

export const orderStatuses = [
  "pending",
  "paid",
  "failed",
  "expired",
  "canceled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orders = pgTable(
  "orders",
  {
    // Generated in the app so one batch can insert the order and its items.
    id: uuid("id").primaryKey(),
    // Null for guest checkouts.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: orderStatuses }).notNull().default("pending"),
    currency: text("currency").notNull().default("gbp"),
    // Minor units (pence; cents on early USD orders), computed on the server
    // from live product prices. `shipping` is the delivery option the shopper
    // chose on Stripe, so `total` is only final once the session completes.
    subtotal: integer("subtotal").notNull(),
    shipping: integer("shipping").notNull().default(0),
    total: integer("total").notNull(),
    // The account email, or what the guest entered on Stripe.
    email: text("email"),
    shippingName: text("shipping_name"),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // When the Checkout Session, and so the stock reservation, lapses.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Set when Stripe took a payment the order couldn't accept (wrong amount,
    // or after the hold was released), for a person to refund or fulfil by
    // hand. Cleared when an admin marks it resolved.
    attentionReason: text("attention_reason"),
    ...timestamps,
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_status_expires_at_idx").on(table.status, table.expiresAt),
    index("orders_stripe_payment_intent_id_idx").on(table.stripePaymentIntentId),
    index("orders_attention_idx")
      .on(table.createdAt)
      .where(sql`${table.attentionReason} is not null`),
    check(
      "orders_status_check",
      sql`${table.status} in ('pending', 'paid', 'failed', 'expired', 'canceled')`,
    ),
    check(
      "orders_total_check",
      sql`${table.subtotal} >= 0 and ${table.shipping} >= 0 and ${table.total} >= 0`,
    ),
  ],
);

// Stripe's address shape, as collected on the Checkout page.
export type ShippingAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

// Name, reference and price are snapshots, so an order still reads correctly
// after the product is edited or deleted.
export const orderItems = pgTable(
  "order_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    reference: text("reference").notNull(),
    // Minor units, in the order's currency.
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    check("order_items_unit_price_check", sql`${table.unitPrice} >= 0`),
  ],
);

// Ledger of Stripe webhook events already handled, so redeliveries are skipped.
// Pruned after 30 days by the hold sweep (`src/features/checkout/order-sweep.ts`); Stripe
// stops retrying an event after three.
export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("stripe_events_processed_at_idx").on(table.processedAt)],
);

// Fixed-window counters keyed by scope and client IP: checkout, order lookup
// and restock alerts. Named for checkout, its first use. Separate from Better
// Auth's `rate_limit`, which deletes rows older than its own (shorter)
// windows. Written through `src/lib/rate-limit.ts`.
export const checkoutRateLimits = pgTable("checkout_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

// --- Admin history -----------------------------------------------------------
// Append-only record of admin changes: who, what, and the values before and
// after. Each row is written in the same statement as the change it records
// (`src/features/admin/admin-events.ts`), so the history can't miss one. No foreign keys:
// it outlives deleted products, categories and admins.

export const adminEvents = pgTable(
  "admin_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    actorId: text("actor_id"),
    // Snapshot, so the history still names an admin after they're deleted.
    actorEmail: text("actor_email").notNull(),
    entity: text("entity", { enum: adminEventAreas }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    // What the entity was called at the time, for rows that outlive it.
    label: text("label").notNull(),
    changes: jsonb("changes")
      .$type<FieldChanges>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_events_entity_idx").on(table.entity, table.entityId, table.createdAt),
    index("admin_events_created_at_idx").on(table.createdAt),
  ],
);

// --- Wishlist ----------------------------------------------------------------
// Signed-in users' saved pieces. Guests keep theirs in the `wishlist` cookie
// until they sign in. Reads and writes go through `src/features/wishlist/wishlist.ts`.

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

// --- Back-in-stock alerts ----------------------------------------------------
// One row per email per sold-out product, asked for on the product page. The
// email goes once the product has stock again; `notified_at` marks it sent.
// Written through `src/features/restock-alerts/restock-alerts.ts`; sent rows are pruned after 30 days.

export const restockAlerts = pgTable(
  "restock_alerts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // Stored lowercased, so the unique index catches repeats.
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("restock_alerts_product_id_email_idx").on(table.productId, table.email),
    index("restock_alerts_notified_at_idx").on(table.notifiedAt),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  orders: many(orders),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
