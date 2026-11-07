// Drizzle table definitions go here.
// Better Auth tables can be generated with `pnpm dlx auth generate`.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
