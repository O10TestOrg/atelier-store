// Demo data for the public showcase, on top of `pnpm db:seed`: customers,
// orders in every state, back-in-stock requests, admin history, products in
// every status, and the read-only `viewer` login visitors use for /admin.
// Run with `DEMO_VIEWER_PASSWORD=… pnpm db:seed-demo` (DEMO_VIEWER_EMAIL is
// optional).
//
// Safe to re-run. Accounts and orders have fixed ids and are skipped once
// they exist; products upsert on slug but keep their status and stock once an
// admin has touched them; the history rows of the made-up store manager are
// replaced. Dates are relative to now, so re-run it to freshen the dashboard.
// Like `db:make-admin`, it writes rows directly rather than through the admin
// helpers.
import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { unsplash } from "../features/catalog/catalog";
import { DEMO_EMAIL_DOMAIN } from "../lib/roles";
import {
  account,
  adminEvents,
  categories,
  orderItems,
  orders,
  products,
  restockAlerts,
  user,
  wishlistItems,
  type OrderStatus,
  type ShippingAddress,
} from "./schema";

loadEnvConfig(process.cwd());

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 60 * 60 * 1000);

// Order ids are UUIDs and their first 8 characters are the reference, so
// derive them from a key: stable across runs, and varied.
function demoUuid(key: string) {
  const hex = createHash("sha256").update(`atelier-demo:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const email = (local: string) => `${local}@${DEMO_EMAIL_DOMAIN}`;

// --- Accounts -----------------------------------------------------------------

const MANAGER = { id: "demo-manager", name: "Harriet Lane", email: email("manager") };

// No password: nobody can sign in as these. Only the viewer below can.
const accounts = [
  { ...MANAGER, role: "admin" as const, emailVerified: true, createdAt: ago(120) },
  { id: "demo-amara", name: "Amara Okafor", email: email("amara"), emailVerified: true, createdAt: ago(95) },
  { id: "demo-tom", name: "Tom Hughes", email: email("tom"), emailVerified: true, createdAt: ago(80) },
  { id: "demo-james", name: "James Whitfield", email: email("james"), emailVerified: true, createdAt: ago(70) },
  { id: "demo-noah", name: "Noah Williams", email: email("noah"), emailVerified: true, createdAt: ago(52) },
  { id: "demo-sofia", name: "Sofia Romano", email: email("sofia"), emailVerified: true, createdAt: ago(33) },
  { id: "demo-lena", name: "Lena Fischer", email: email("lena"), emailVerified: false, createdAt: ago(16) },
  { id: "demo-priya", name: "Priya Shah", email: email("priya"), emailVerified: false, createdAt: ago(2) },
];

// --- Products -----------------------------------------------------------------
// Pieces added through /admin that the demo shows, plus one for each state the
// admin lists have: drafts (one barely started), a low-stock piece and an
// archived one that orders still point to.

type DemoProduct = Omit<
  typeof products.$inferInsert,
  "id" | "categoryId" | "createdAt" | "updatedAt" | "publishedAt"
> & { category: string; publishedDaysAgo: number | null; createdDaysAgo: number };

const productData: DemoProduct[] = [
  {
    slug: "cleo-gold-hoops",
    reference: "AT-B0143",
    name: "Cleo Gold Hoops",
    category: "accessories",
    price: 50000,
    stock: 9,
    image: unsplash("1708220040870-7e447421947f"),
    imageAlt: "Polished yellow gold hoop earrings with a sculpted twisted finish.",
    detailFocus: "65% 50%",
    isNew: true,
    colour: "Gold",
    description:
      "A pair of sculptural hoop earrings in 18k yellow gold, finished with a subtle twist that catches the light and elevates everyday wear.",
    details: [
      "18k yellow gold-plated sterling silver",
      "Hinge-snap post closure",
      "Hollow lightweight construction",
      "Engraved logo at the interior clasp",
      "2.2 × 2.2 × 0.4 cm",
    ],
    status: "active",
    createdDaysAgo: 26,
    publishedDaysAgo: 25,
  },
  {
    slug: "celeste-rim-sunglasses",
    reference: "AT-B0150",
    name: "Céleste Rim Sunglasses",
    category: "accessories",
    price: 34500,
    stock: 8,
    image: unsplash("1619352519206-8cd0076560b5"),
    imageAlt: "Rose gold cat-eye sunglasses with beaded metal rims and plum gradient lenses",
    detailFocus: "65% 50%",
    isNew: true,
    colour: "Pink",
    description:
      "A refined cat-eye silhouette in polished rose gold metal, edged with delicate beading and fitted with soft plum gradient lenses for effortless sun protection.",
    details: [
      "Rose gold-tone metal frame with beaded rim trim",
      "UV-protective plum gradient lenses",
      "Adjustable silicone nose pads",
      "Slim metal temples with clear acetate tips",
      "58 × 14 × 140 mm",
    ],
    status: "draft",
    createdDaysAgo: 6,
    publishedDaysAgo: null,
  },
  {
    slug: "meridian-carry-on",
    reference: "AT-B0152",
    name: "Meridian Carry-On",
    category: "travel",
    price: 45299,
    stock: 0,
    image: unsplash("1568571959361-3bffbad07499"),
    imageAlt: "Minimalist black aluminum carry-on suitcase with four spinner wheels and a telescopic handle",
    detailFocus: "50% 50%",
    isNew: true,
    colour: "Black",
    description:
      "A sleek hard-shell cabin suitcase in matte black aluminum, engineered with dual combination locks and smooth 360-degree wheels for effortless transit.",
    details: [
      "Anodized matte black aluminum shell with reinforced corners",
      "Dual integrated TSA-approved combination locks",
      "Multi-stage telescopic trolley handle",
      "Four 360-degree dual spinner wheels",
      "55 × 38 × 22 cm",
    ],
    status: "active",
    createdDaysAgo: 40,
    publishedDaysAgo: 39,
  },
  {
    slug: "kensington-weekender",
    reference: "AT-T0144",
    name: "Kensington Weekender",
    category: "travel",
    price: 41450,
    stock: 5,
    image: unsplash("1650286712513-e1419fa096b2"),
    imageAlt: "Cognac pebbled leather duffle bag with rolled top handles and silver-tone hardware",
    detailFocus: "50% 50%",
    isNew: true,
    colour: "Cognac",
    description:
      "A spacious weekender bag in supple cognac pebbled leather, featuring a wide top zip opening and sturdy rolled handles designed for overnight travel or daily commutes.",
    details: [
      "Full-grain cognac pebbled leather with tonal stitching",
      "Full-length top zip closure with side D-ring attachments",
      "Twin rolled leather top handles",
      "Interior padded laptop sleeve and slip pockets",
      "48 × 26 × 22 cm",
    ],
    status: "active",
    createdDaysAgo: 22,
    publishedDaysAgo: 21,
  },
  {
    slug: "selvedge-denim-jacket",
    reference: "AT-R0321",
    name: "Selvedge Denim Jacket",
    category: "ready-to-wear",
    price: 68000,
    stock: 1,
    image: unsplash("1611312449408-fcece27cdbb7"),
    imageAlt: "Indigo denim jacket with a tan corduroy collar on a hanger",
    detailFocus: "50% 40%",
    isNew: true,
    colour: "Indigo",
    description:
      "A boxy trucker jacket in raw Japanese selvedge denim, with a corduroy collar and copper shank buttons. It fades to fit the way it's worn.",
    details: [
      "100% cotton selvedge denim, 14 oz",
      "Corduroy collar",
      "Copper shank buttons",
      "Two chest flap pockets, two hand pockets",
      "Boxy fit; take your usual size",
    ],
    status: "active",
    createdDaysAgo: 10,
    publishedDaysAgo: 8,
  },
  {
    slug: "bordeaux-croc-top-handle",
    reference: "AT-B0121",
    name: "Bordeaux Croc Top-Handle",
    category: "bags",
    price: 179000,
    stock: 0,
    image: unsplash("1575032617751-6ddec2089882"),
    imageAlt: "Burgundy croc-embossed leather bag with a gold clasp held by its top handle",
    detailFocus: "55% 45%",
    colour: "Bordeaux",
    description:
      "A compact top-handle bag in glossy croc-embossed calfskin, closed with a sculpted gold-tone clasp.",
    details: [
      "Croc-embossed calfskin",
      "Gold-tone clasp closure",
      "Fixed top handle",
      "Suede lining with a slip pocket",
      "20 × 22 × 8 cm",
    ],
    status: "archived",
    createdDaysAgo: 65,
    publishedDaysAgo: 64,
  },
  {
    slug: "harbour-canvas-backpack",
    reference: "AT-T0030",
    name: "Harbour Canvas Backpack",
    category: "travel",
    price: 38000,
    stock: 15,
    image: unsplash("1553062407-98eeb64c6a62"),
    imageAlt: "Navy waxed canvas backpack standing on a pale floor",
    detailFocus: "50% 50%",
    colour: "Navy",
    description:
      "A clean-lined daypack in waxed cotton canvas with leather trims, a padded laptop sleeve and a water-resistant base.",
    details: [
      "Waxed cotton canvas with leather trims",
      "Two-way zip opening",
      "Padded laptop sleeve, fits 14 inch",
      "30 × 40 × 12 cm",
    ],
    status: "draft",
    createdDaysAgo: 3,
    publishedDaysAgo: null,
  },
  {
    slug: "atlas-bifold-wallet",
    reference: "AT-A0071",
    name: "Atlas Bifold Wallet",
    category: "accessories",
    price: 19500,
    stock: 0,
    image: unsplash("1627123424574-724758594e93"),
    imageAlt: "Brown leather bifold wallet",
    detailFocus: "50% 50%",
    colour: "Tobacco",
    description: "Copy to come. Waiting on final photography and the stock count from the workshop.",
    details: [],
    status: "draft",
    createdDaysAgo: 1,
    publishedDaysAgo: null,
  },
];

// --- Orders ---------------------------------------------------------------------

const address = (
  line1: string,
  city: string,
  postal_code: string,
  country: string,
  state: string | null = null,
): ShippingAddress => ({ line1, line2: null, city, state, postal_code, country });

type DemoOrder = {
  key: string;
  status: Exclude<OrderStatus, "pending">;
  userId?: string;
  email: string;
  currency?: "gbp" | "usd";
  daysAgo: number;
  hoursAgo?: number;
  shipping?: number;
  ship?: { name: string; address: ShippingAddress };
  attentionReason?: string;
  items: { slug: string; quantity: number; unitPrice?: number }[];
};

const LATE_PAYMENT =
  "Paid on Stripe after this order was expired and its stock released. Refund the payment, or restock and fulfil it by hand.";
const RESOLVED_PAYMENT =
  "Paid on Stripe, but the amount or currency didn’t match this order. Check the payment, then refund it or fulfil the order by hand.";

// No `pending` orders: the hold sweep would hand back stock they never took.
const orderData: DemoOrder[] = [
  {
    key: "guest-gb-today",
    status: "paid",
    email: email("ellie.marsh"),
    daysAgo: 0,
    hoursAgo: 3,
    ship: { name: "Ellie Marsh", address: address("14 Elm Row", "Edinburgh", "EH7 4AA", "GB") },
    items: [{ slug: "rondo-sunglasses", quantity: 1 }],
  },
  {
    key: "sofia-weekender",
    status: "paid",
    userId: "demo-sofia",
    email: email("sofia"),
    daysAgo: 1,
    shipping: 2500,
    ship: { name: "Sofia Romano", address: address("Via dei Coronari 22", "Roma", "00186", "IT") },
    items: [
      { slug: "kensington-weekender", quantity: 1 },
      { slug: "cleo-gold-hoops", quantity: 1 },
    ],
  },
  {
    key: "noah-abandoned",
    status: "expired",
    userId: "demo-noah",
    email: email("noah"),
    daysAgo: 1,
    hoursAgo: 6,
    items: [{ slug: "lambskin-biker-jacket", quantity: 1 }],
  },
  {
    key: "amara-recent",
    status: "paid",
    userId: "demo-amara",
    email: email("amara"),
    daysAgo: 2,
    ship: { name: "Amara Okafor", address: address("8 Canonbury Place", "London", "N1 2NQ", "GB") },
    items: [
      { slug: "lumen-chain-bag", quantity: 1 },
      { slug: "rondo-sunglasses", quantity: 1 },
    ],
  },
  {
    key: "late-payment",
    status: "expired",
    email: email("lena"),
    daysAgo: 3,
    attentionReason: LATE_PAYMENT,
    items: [{ slug: "panier-woven-tote", quantity: 1 }],
  },
  {
    key: "james-us",
    status: "paid",
    userId: "demo-james",
    email: email("james"),
    daysAgo: 5,
    shipping: 4500,
    ship: {
      name: "James Whitfield",
      address: address("410 Hudson Street", "New York", "10014", "US", "NY"),
    },
    items: [{ slug: "voyage-backpack", quantity: 1 }],
  },
  {
    key: "guest-canceled",
    status: "canceled",
    email: email("guest.shopper"),
    daysAgo: 6,
    items: [{ slug: "field-bomber", quantity: 1 }],
  },
  {
    key: "tom-failed",
    status: "failed",
    userId: "demo-tom",
    email: email("tom"),
    daysAgo: 8,
    items: [{ slug: "fringed-knit-poncho", quantity: 2 }],
  },
  {
    key: "sofia-first",
    status: "paid",
    userId: "demo-sofia",
    email: email("sofia"),
    daysAgo: 9,
    shipping: 2500,
    ship: { name: "Sofia Romano", address: address("Via dei Coronari 22", "Roma", "00186", "IT") },
    items: [{ slug: "selvedge-denim-jacket", quantity: 1 }],
  },
  {
    key: "resolved-mismatch",
    status: "canceled",
    email: email("claire"),
    daysAgo: 12,
    items: [{ slug: "maree-satchel", quantity: 1 }],
  },
  {
    key: "guest-fr",
    status: "paid",
    email: email("claire"),
    daysAgo: 14,
    shipping: 2500,
    ship: { name: "Claire Dubois", address: address("5 Rue des Rosiers", "Paris", "75004", "FR") },
    items: [{ slug: "maree-satchel", quantity: 1 }],
  },
  {
    key: "amara-next-day",
    status: "paid",
    userId: "demo-amara",
    email: email("amara"),
    daysAgo: 21,
    shipping: 1500,
    ship: { name: "Amara Okafor", address: address("8 Canonbury Place", "London", "N1 2NQ", "GB") },
    items: [{ slug: "meridian-carry-on", quantity: 1 }],
  },
  {
    key: "noah-multi",
    status: "paid",
    userId: "demo-noah",
    email: email("noah"),
    daysAgo: 30,
    ship: { name: "Noah Williams", address: address("27 Park Row", "Bristol", "BS1 5LJ", "GB") },
    items: [
      { slug: "field-bomber", quantity: 1 },
      { slug: "rondo-sunglasses", quantity: 2 },
      { slug: "fringed-knit-poncho", quantity: 1 },
    ],
  },
  {
    key: "tom-archived",
    status: "paid",
    userId: "demo-tom",
    email: email("tom"),
    daysAgo: 45,
    ship: { name: "Tom Hughes", address: address("3 Albion Street", "Leeds", "LS1 6AG", "GB") },
    // Bought before the price change (see the history below).
    items: [{ slug: "bordeaux-croc-top-handle", quantity: 1, unitPrice: 189000 }],
  },
  {
    // Early orders were taken in US dollars, in cents.
    key: "james-usd",
    status: "paid",
    userId: "demo-james",
    email: email("james"),
    currency: "usd",
    daysAgo: 58,
    shipping: 5500,
    ship: {
      name: "James Whitfield",
      address: address("410 Hudson Street", "New York", "10014", "US", "NY"),
    },
    items: [{ slug: "bordeaux-croc-top-handle", quantity: 1, unitPrice: 229000 }],
  },
];

// Sold-out pieces people are waiting for. `notified` ones were already sent.
const alertData: { slug: string; email: string; daysAgo: number; notified?: number }[] = [
  { slug: "maree-satchel", email: email("amara"), daysAgo: 13 },
  { slug: "maree-satchel", email: email("lena"), daysAgo: 9 },
  { slug: "maree-satchel", email: email("hannah.k"), daysAgo: 4 },
  { slug: "meridian-carry-on", email: email("tom"), daysAgo: 7 },
  { slug: "meridian-carry-on", email: email("priya"), daysAgo: 1 },
  { slug: "panier-woven-tote", email: email("sofia"), daysAgo: 28, notified: 20 },
];

const wishlistData = [
  { userId: "demo-amara", slugs: ["maree-satchel", "lambskin-biker-jacket", "kensington-weekender"] },
  { userId: "demo-sofia", slugs: ["lumen-chain-bag", "cleo-gold-hoops"] },
  { userId: "demo-priya", slugs: ["meridian-carry-on"] },
];

async function main() {
  const password = process.env.DEMO_VIEWER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Set DEMO_VIEWER_PASSWORD (8+ characters) for the demo admin login.");
  }
  const viewerEmail = (process.env.DEMO_VIEWER_EMAIL || email("demo")).toLowerCase();

  // Imported after loading env: `db` throws when DATABASE_URL is missing.
  const { db } = await import("./index");

  // Accounts. The viewer's password follows the env var on every run.
  const viewer = {
    id: "demo-viewer",
    name: "Demo Viewer",
    email: viewerEmail,
    role: "viewer" as const,
    emailVerified: true,
  };
  await db
    .insert(user)
    .values([viewer, ...accounts.map((a) => ({ role: "customer" as const, ...a }))])
    .onConflictDoNothing();
  await db.update(user).set({ role: "viewer" }).where(eq(user.id, viewer.id));
  await db
    .insert(account)
    .values({
      id: "demo-viewer-credential",
      accountId: viewer.id,
      providerId: "credential",
      userId: viewer.id,
      password: await hashPassword(password),
    })
    .onConflictDoUpdate({
      target: account.id,
      set: { password: sql.raw("excluded.password"), updatedAt: new Date() },
    });

  // Products. New ones go in as described; existing ones keep the status and
  // stock an admin may have set since.
  const categoryRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const categoryIds = new Map(categoryRows.map((c) => [c.slug, c.id]));
  for (const { category, publishedDaysAgo, createdDaysAgo, ...product } of productData) {
    const categoryId = categoryIds.get(category);
    if (!categoryId) throw new Error(`Unknown category "${category}". Run pnpm db:seed first.`);
    await db
      .insert(products)
      .values({
        ...product,
        categoryId,
        publishedAt: publishedDaysAgo === null ? null : ago(publishedDaysAgo),
        createdAt: ago(createdDaysAgo),
        updatedAt: ago(Math.max(0, createdDaysAgo - 1)),
      })
      .onConflictDoNothing({ target: products.slug });
  }

  const productRows = await db
    .select({ id: products.id, slug: products.slug, name: products.name, reference: products.reference, price: products.price })
    .from(products);
  const bySlug = new Map(productRows.map((p) => [p.slug, p]));
  const product = (slug: string) => {
    const found = bySlug.get(slug);
    if (!found) throw new Error(`Unknown product "${slug}". Run pnpm db:seed first.`);
    return found;
  };

  // Orders and their item snapshots, in one batch per order.
  const existing = new Set(
    (
      await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.id, orderData.map((o) => demoUuid(o.key))))
    ).map((o) => o.id),
  );
  let added = 0;
  for (const order of orderData) {
    const id = demoUuid(order.key);
    if (existing.has(id)) continue;
    const items = order.items.map(({ slug, quantity, unitPrice }) => {
      const p = product(slug);
      return {
        orderId: id,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        reference: p.reference,
        unitPrice: unitPrice ?? p.price,
        quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const shipping = order.status === "paid" ? (order.shipping ?? 0) : 0;
    const createdAt = ago(order.daysAgo, order.hoursAgo);
    await db.batch([
      db.insert(orders).values({
        id,
        userId: order.userId ?? null,
        status: order.status,
        currency: order.currency ?? "gbp",
        subtotal,
        shipping,
        total: subtotal + shipping,
        email: order.email,
        shippingName: order.ship?.name ?? null,
        shippingAddress: order.ship?.address ?? null,
        stripeCheckoutSessionId: `cs_test_demo_${id.replaceAll("-", "")}`,
        expiresAt: new Date(createdAt.getTime() + 31 * 60 * 1000),
        paidAt: order.status === "paid" ? new Date(createdAt.getTime() + 4 * 60 * 1000) : null,
        attentionReason: order.attentionReason ?? null,
        createdAt,
        updatedAt: createdAt,
      }),
      db.insert(orderItems).values(items),
    ]);
    added++;
  }

  await db
    .insert(restockAlerts)
    .values(
      alertData.map((a) => ({
        productId: product(a.slug).id,
        email: a.email,
        createdAt: ago(a.daysAgo),
        notifiedAt: a.notified === undefined ? null : ago(a.notified),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(wishlistItems)
    .values(
      wishlistData.flatMap(({ userId, slugs }) =>
        slugs.map((slug) => ({ userId, productId: product(slug).id })),
      ),
    )
    .onConflictDoNothing();

  // The store manager's history, rebuilt on every run so it stays in step
  // with the dates above.
  const actor = { actorId: MANAGER.id, actorEmail: MANAGER.email };
  const bordeaux = product("bordeaux-croc-top-handle");
  const denim = product("selvedge-denim-jacket");
  const clothing = categoryIds.get("ready-to-wear");
  const resolved = demoUuid("resolved-mismatch");
  const events: Omit<typeof adminEvents.$inferInsert, "actorId" | "actorEmail">[] = [
    {
      entity: "product",
      entityId: String(bordeaux.id),
      action: "create",
      label: bordeaux.name,
      changes: {
        status: { from: null, to: "draft" },
        price: { from: null, to: 189000 },
        stock: { from: null, to: 6 },
      },
      createdAt: ago(65),
    },
    {
      entity: "product",
      entityId: String(bordeaux.id),
      action: "status",
      label: bordeaux.name,
      changes: { status: { from: "draft", to: "active" } },
      createdAt: ago(64),
    },
    {
      entity: "user",
      entityId: "demo-noah",
      action: "role",
      label: email("noah"),
      changes: { role: { from: "customer", to: "admin" } },
      createdAt: ago(48),
    },
    {
      entity: "product",
      entityId: String(bordeaux.id),
      action: "update",
      label: bordeaux.name,
      changes: { price: { from: 189000, to: 179000 } },
      createdAt: ago(40),
    },
    {
      entity: "product",
      entityId: String(bordeaux.id),
      action: "stock",
      label: bordeaux.name,
      changes: { stock: { from: 2, to: 0 } },
      createdAt: ago(38),
    },
    {
      entity: "user",
      entityId: "demo-noah",
      action: "role",
      label: email("noah"),
      changes: { role: { from: "admin", to: "customer" } },
      createdAt: ago(31),
    },
    ...(clothing === undefined
      ? []
      : [
          {
            entity: "category" as const,
            entityId: String(clothing),
            action: "rename",
            label: "Clothing",
            changes: { name: { from: "Ready-to-wear", to: "Clothing" } },
            createdAt: ago(29),
          },
        ]),
    {
      entity: "category",
      entityId: "999",
      action: "delete",
      label: "Gift sets",
      createdAt: ago(27),
    },
    {
      entity: "product",
      entityId: String(bordeaux.id),
      action: "status",
      label: bordeaux.name,
      changes: { status: { from: "active", to: "archived" } },
      createdAt: ago(20),
    },
    {
      entity: "order",
      entityId: resolved,
      action: "resolve",
      label: resolved.slice(0, 8).toUpperCase(),
      changes: {
        attention: { from: RESOLVED_PAYMENT, to: null },
        note: { from: null, to: "Charged in euros by mistake. Refunded in full on Stripe and let the customer know." },
      },
      createdAt: ago(11),
    },
    {
      entity: "product",
      entityId: String(denim.id),
      action: "create",
      label: denim.name,
      changes: {
        status: { from: null, to: "draft" },
        price: { from: null, to: 72000 },
        stock: { from: null, to: 6 },
      },
      createdAt: ago(10),
    },
    {
      entity: "product",
      entityId: String(denim.id),
      action: "update",
      label: denim.name,
      changes: {
        price: { from: 72000, to: 68000 },
        colour: { from: "Blue", to: "Indigo" },
      },
      createdAt: ago(9),
    },
    {
      entity: "product",
      entityId: String(denim.id),
      action: "status",
      label: denim.name,
      changes: { status: { from: "draft", to: "active" } },
      createdAt: ago(8),
    },
    {
      entity: "product",
      entityId: String(denim.id),
      action: "stock",
      label: denim.name,
      changes: { stock: { from: 6, to: 1 } },
      createdAt: ago(4),
    },
    ...(["harbour-canvas-backpack", "atlas-bifold-wallet"] as const).map((slug, i) => {
      const p = product(slug);
      return {
        entity: "product" as const,
        entityId: String(p.id),
        action: "create",
        label: p.name,
        changes: {
          status: { from: null, to: "draft" },
          price: { from: null, to: p.price },
        },
        createdAt: ago(i === 0 ? 3 : 1),
      };
    }),
  ];
  await db.batch([
    db.delete(adminEvents).where(eq(adminEvents.actorId, MANAGER.id)),
    db.insert(adminEvents).values(events.map((event) => ({ ...actor, ...event }))),
  ]);

  console.log(
    `Demo data ready: ${accounts.length + 1} accounts, ${added} new orders, ${events.length} history rows. ` +
      `Demo admin login: ${viewerEmail}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
