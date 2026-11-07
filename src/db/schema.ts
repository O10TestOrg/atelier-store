// Drizzle table definitions go here.
// Better Auth tables were generated with `pnpm dlx auth generate`; re-run it
// after changing auth plugins or fields and merge the diff by hand.
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  jsonb,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
    // Minor units (cents).
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
    check("products_price_check", sql`${table.price} >= 0`),
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

// --- Orders ------------------------------------------------------------------
// One order per Stripe Checkout Session. Created `pending` at checkout start,
// in the same batch that reserves its stock; only Stripe (webhook or a
// server-side session read) moves it on. Reads and writes go through
// `src/lib/orders.ts`.

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
    currency: text("currency").notNull().default("usd"),
    // Minor units (cents), computed on the server from live product prices.
    subtotal: integer("subtotal").notNull(),
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
    ...timestamps,
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_status_expires_at_idx").on(table.status, table.expiresAt),
    check(
      "orders_status_check",
      sql`${table.status} in ('pending', 'paid', 'failed', 'expired', 'canceled')`,
    ),
    check(
      "orders_total_check",
      sql`${table.subtotal} >= 0 and ${table.total} >= 0`,
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
    // Minor units (cents).
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
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Wishlist ----------------------------------------------------------------
// Signed-in users' saved pieces. Guests keep theirs in the `wishlist` cookie
// until they sign in. Reads and writes go through `src/lib/wishlist.ts`.

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
