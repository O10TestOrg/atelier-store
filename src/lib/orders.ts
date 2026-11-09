// Orders and the stock they reserve. Every status change is conditional on the
// order still being `pending`, so duplicate or out-of-order Stripe events (and
// the success page racing the webhook) are harmless no-ops.
//
// `drizzle-orm/neon-http` has no interactive transactions: multi-step writes
// here are a single `db.batch` (one transaction on Neon) or a single SQL
// statement. `products_stock_check` (stock >= 0) is the final guard against
// overselling under concurrent checkouts.
import "server-only";
import type Stripe from "stripe";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orderStatuses,
  orders,
  products,
  stripeEvents,
  user,
  type OrderStatus,
} from "@/db/schema";
import { STORE_CURRENCY } from "@/lib/catalog";
import { CHECK_VIOLATION, FOREIGN_KEY_VIOLATION, pgError } from "@/lib/db-errors";
import { isCheckoutSessionId, isOrderId } from "@/lib/ids";
import { writeWithEvent, type AdminEventInput } from "@/lib/admin-events";
import { likePattern, type CheckoutProduct } from "@/lib/products";

export type OrderItem = typeof orderItems.$inferSelect & {
  // The product's current photo; null if the product has since been deleted.
  product: { image: string } | null;
};

export type Order = typeof orders.$inferSelect & { items: OrderItem[] };

// Order reads load each item with its product's photo for the thumbnails.
const items = { with: { product: { columns: { image: true } } } } as const;

// Short, human-friendly reference for receipts and the account page.
export const orderReference = (order: Pick<Order, "id">) =>
  order.id.slice(0, 8).toUpperCase();

export type OrderLine ={ product: CheckoutProduct; quantity: number };

export class StockUnavailableError extends Error {
  constructor() {
    super("Stock no longer available");
    this.name = "StockUnavailableError";
  }
}

// Postgres check_violation (stock < 0) and foreign_key_violation (product
// deleted mid-checkout).
function isStockConflict(error: unknown) {
  const { code } = pgError(error);
  return code === CHECK_VIOLATION || code === FOREIGN_KEY_VIOLATION;
}

// Inserts the order and its items and takes the stock, all or nothing. Prices
// come from `lines`, which the caller read fresh from the database.
export async function createPendingOrder(input: {
  id: string;
  userId: string | null;
  email: string | null;
  lines: OrderLine[];
  expiresAt: Date;
}) {
  const { id, lines } = input;
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const reserved = sql.join(
    lines.map((line) => sql`(${line.product.id}::integer, ${line.quantity}::integer)`),
    sql`, `,
  );

  try {
    await db.batch([
      db.insert(orders).values({
        id,
        userId: input.userId,
        email: input.email,
        currency: STORE_CURRENCY,
        subtotal,
        // Delivery is added once the shopper picks an option on Stripe.
        total: subtotal,
        expiresAt: input.expiresAt,
      }),
      db.insert(orderItems).values(
        lines.map(({ product, quantity }) => ({
          orderId: id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          reference: product.reference,
          unitPrice: product.price,
          quantity,
        })),
      ),
      db
        .update(products)
        .set({ stock: sql`${products.stock} - reserved.quantity` })
        .from(sql`(values ${reserved}) as reserved(product_id, quantity)`)
        .where(sql`${products.id} = reserved.product_id`),
    ]);
  } catch (error) {
    if (isStockConflict(error)) throw new StockUnavailableError();
    throw error;
  }
  return { subtotal, total: subtotal };
}

export async function attachCheckoutSession(orderId: string, sessionId: string) {
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(orders.id, orderId));
}

// Moves a pending order to `status` and puts its stock back, in one statement.
// Returns false when the order wasn't pending (already handled), so it never
// restocks twice. Callers revalidate the "products" tag when it returns true.
export async function releaseOrder(
  orderId: string,
  status: Exclude<OrderStatus, "pending" | "paid">,
) {
  const result = await db.execute<{ released: number }>(sql`
    with released as (
      update orders set status = ${status}, updated_at = now()
      where id = ${orderId} and status = 'pending'
      returning id
    ), restocked as (
      update products set stock = products.stock + order_items.quantity
      from order_items join released on released.id = order_items.order_id
      where products.id = order_items.product_id
      returning products.id
    )
    select count(*)::integer as released from released
  `);
  return Number(result.rows[0]?.released ?? 0) > 0;
}

// Pending orders whose hold lapsed more than `graceMinutes` ago, oldest first,
// for the sweep in `src/lib/order-sweep.ts`. The grace lets Stripe's own
// expiry webhook win the normal case. Orders completed on Stripe (they have a
// shipping address) are left alone: async payments stay pending for days.
export async function getLapsedPendingOrders(limit: number, graceMinutes = 5) {
  return db
    .select({ id: orders.id, stripeCheckoutSessionId: orders.stripeCheckoutSessionId })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        lt(orders.expiresAt, sql`now() - make_interval(mins => ${graceMinutes})`),
        isNull(orders.shippingAddress),
      ),
    )
    .orderBy(asc(orders.expiresAt))
    .limit(limit);
}


export async function getPendingOrder(orderId: string) {
  if (!isOrderId(orderId)) return undefined;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .limit(1);
  return order;
}

// Any order with its items, whatever its status, for the bag to see what this
// browser's checkout became. Callers must already know the id is theirs (the
// httpOnly pending_checkout cookie).
export async function getCheckoutOrder(orderId: string): Promise<Order | undefined> {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items },
  });
}

// The order a Checkout Session belongs to, cross-checked three ways: metadata,
// client_reference_id and (once attached) the stored session id.
export async function findOrderForSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || !isOrderId(orderId) || session.client_reference_id !== orderId) {
    return null;
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return null;
  }
  return order;
}

// Releases the hold of a session that expired or failed, for the webhook and
// /checkout/return. True when this call released it, so the caller refreshes
// product data and sends restock alerts once.
export async function releaseSessionOrder(
  session: Stripe.Checkout.Session,
  status: "failed" | "expired",
) {
  const order = await findOrderForSession(session);
  if (!order) {
    console.error("Stripe session has no matching order", { sessionId: session.id });
    return false;
  }
  return releaseOrder(order.id, status);
}

// What the session charged on top of the items: the delivery option the
// shopper chose. The rates are created inline by `startCheckout`, so the
// shopper can't set one, but the sums are still checked.
function chargedShipping(session: Stripe.Checkout.Session) {
  const shipping = session.shipping_cost?.amount_total ?? 0;
  const consistent =
    session.amount_subtotal !== null &&
    session.amount_total === session.amount_subtotal + shipping;
  return consistent ? { shipping, total: session.amount_total! } : null;
}

// Records a completed Checkout Session. Marks the order paid only when Stripe
// says it's paid, the items cost what we priced them at, and the total is
// those items plus the chosen delivery, in our currency. Async payment
// methods complete as `unpaid` first: the order stays pending, and its stock
// stays held, until `async_payment_succeeded` or `_failed` arrives.
export async function applyCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<OrderStatus | null> {
  const order = await findOrderForSession(session);
  if (!order) {
    console.error("Stripe session has no matching order", { sessionId: session.id });
    return null;
  }

  const shipping = session.collected_information?.shipping_details;
  const details = {
    stripeCheckoutSessionId: session.id,
    email: session.customer_details?.email ?? order.email,
    shippingName: shipping?.name ?? null,
    shippingAddress: shipping?.address ?? null,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
  };
  const isPending = and(eq(orders.id, order.id), eq(orders.status, "pending"));
  const charged = chargedShipping(session);
  const matches = and(
    isPending,
    eq(orders.subtotal, charged ? session.amount_subtotal! : -1),
    eq(orders.currency, session.currency ?? ""),
  );

  if (session.payment_status !== "paid") {
    await db.update(orders).set(details).where(isPending);
    if (charged) await db.update(orders).set(charged).where(matches);
    return order.status;
  }

  const [paid] = await db
    .update(orders)
    .set({ ...details, ...charged, status: "paid", paidAt: new Date() })
    .where(matches)
    .returning({ id: orders.id });
  if (paid) return "paid";

  const [current] = await db
    .select({ status: orders.status, subtotal: orders.subtotal })
    .from(orders)
    .where(eq(orders.id, order.id));
  if (current && current.status !== "paid") {
    // Paid, but not for what we expected, or after the order was released.
    // Retrying won't help: flag it for a person to refund or fulfil by hand.
    // The status stays as it is (only a matching payment makes it paid), and
    // the shipping details stay off it, so the customer's history doesn't
    // change; Stripe has the address.
    const attentionReason =
      current.status === "pending"
        ? "Paid on Stripe, but the amount or currency didn’t match this order. Check the payment, then refund it or fulfil the order by hand."
        : `Paid on Stripe after this order was ${current.status} and its stock released. Refund the payment, or restock and fulfil it by hand.`;
    await db
      .update(orders)
      .set({
        attentionReason,
        stripePaymentIntentId: details.stripePaymentIntentId,
        email: details.email,
      })
      .where(and(eq(orders.id, order.id), ne(orders.status, "paid")));
    console.error("Paid Stripe session could not be applied to its order", {
      orderId: order.id,
      sessionId: session.id,
      status: current?.status,
      expected: current?.subtotal,
      receivedSubtotal: session.amount_subtotal,
      receivedTotal: session.amount_total,
    });
  }
  return current?.status ?? null;
}

export async function isEventProcessed(eventId: string) {
  const [row] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, eventId))
    .limit(1);
  return Boolean(row);
}

export async function markEventProcessed(event: Stripe.Event) {
  await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing();
}

// Stripe stops redelivering an event after three days, so a month of ledger
// is plenty.
export async function pruneStripeEvents(days = 30) {
  await db
    .delete(stripeEvents)
    .where(lt(stripeEvents.processedAt, sql`now() - make_interval(days => ${days})`));
}

export async function getOrderBySessionId(sessionId: string): Promise<Order | undefined> {
  return db.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    with: { items },
  });
}

// Paid orders, plus any the shopper actually completed on Stripe: an async
// payment still clearing (pending) or one that later failed. A completed
// session has a shipping address; an abandoned, canceled or expired checkout
// doesn't, so it isn't listed.
const isVisibleToCustomer = or(
  eq(orders.status, "paid"),
  isNotNull(orders.shippingAddress),
);

export async function getUserOrders(userId: string): Promise<Order[]> {
  return db.query.orders.findMany({
    where: and(eq(orders.userId, userId), isVisibleToCustomer),
    with: { items },
    orderBy: desc(orders.createdAt),
  });
}

// One of the user's orders, or undefined when it doesn't exist, belongs to
// someone else or isn't listed in their history. Callers treat all three as
// a 404, so order ids can't be probed.
export async function getUserOrder(
  userId: string,
  orderId: string,
): Promise<Order | undefined> {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId), isVisibleToCustomer),
    with: { items },
  });
}

// Moves guest orders placed with `email` into the account, so they show in its
// history. Only call it with an email the account has verified: otherwise
// anyone could sign up as a customer's address and read their orders.
export async function claimGuestOrders(userId: string, email: string) {
  await db
    .update(orders)
    .set({ userId })
    .where(and(isNull(orders.userId), sql`lower(${orders.email}) = lower(${email})`));
}

// Orders matching a reference (the first 8 characters of the id, see
// `orderReference`) and email, for the guest order lookup. Only orders the
// customer could see in an account are found.
export async function findOrdersByReference(reference: string, email: string) {
  if (!/^[0-9a-f]{8}$/i.test(reference)) return [];
  return db
    .select({ id: orders.id, email: orders.email })
    .from(orders)
    .where(
      and(
        sql`${orders.id}::text like ${`${reference.toLowerCase()}%`}`,
        sql`lower(${orders.email}) = lower(${email})`,
        isVisibleToCustomer,
      ),
    )
    .limit(5);
}

// One order for a holder of a signed order link (`src/lib/order-link.ts`).
export async function getLinkedOrder(orderId: string): Promise<Order | undefined> {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), isVisibleToCustomer),
    with: { items },
  });
}

// --- Admin -------------------------------------------------------------------
// Every order, for staff. Callers must have passed `requireAdmin()` first.
// Uncached: admins need live statuses, and these must never share a cache entry.

// "completed" is what customers see in their history; "all" adds abandoned,
// canceled and expired checkouts; "attention" is paid sessions the order
// couldn't accept (`attention_reason`).
export const adminOrderFilters = ["completed", "attention", "all", ...orderStatuses] as const;
export type AdminOrderFilter = (typeof adminOrderFilters)[number];

export const isAdminOrderFilter = (value: unknown): value is AdminOrderFilter =>
  adminOrderFilters.includes(value as AdminOrderFilter);

export const ADMIN_ORDERS_PER_PAGE = 50;

export type AdminOrder = Order & { user: { name: string; email: string } | null };

const needsAttention = isNotNull(orders.attentionReason);

function adminOrderWhere(filter: AdminOrderFilter) {
  if (filter === "completed") return isVisibleToCustomer;
  if (filter === "attention") return needsAttention;
  if (filter === "all") return undefined;
  return eq(orders.status, filter);
}

// What the admin search box matches: a Stripe payment or session id exactly,
// an order id or reference by prefix, otherwise part of the receipt email,
// the account email or the delivery name.
export function adminOrderSearch(query: string) {
  const q = query.trim();
  if (!q) return undefined;
  if (/^pi_[A-Za-z0-9]+$/.test(q)) return eq(orders.stripePaymentIntentId, q);
  if (isCheckoutSessionId(q)) return eq(orders.stripeCheckoutSessionId, q);

  const text = or(
    ilike(orders.email, likePattern(q)),
    ilike(orders.shippingName, likePattern(q)),
    inArray(
      orders.userId,
      db.select({ id: user.id }).from(user).where(ilike(user.email, likePattern(q))),
    ),
  );
  // References are the first 8 hex digits of the id, shown in capitals.
  const idPrefix = q.replace(/^#/, "").toLowerCase();
  return /^[0-9a-f-]{4,36}$/.test(idPrefix)
    ? or(sql`${orders.id}::text like ${`${idPrefix}%`}`, text)
    : text;
}

export async function getAdminOrders(filter: AdminOrderFilter, page: number, query = "") {
  const where = and(adminOrderWhere(filter), adminOrderSearch(query));
  const [list, [{ total }]] = await Promise.all([
    db.query.orders.findMany({
      where,
      with: { items, user: { columns: { name: true, email: true } } },
      orderBy: desc(orders.createdAt),
      limit: ADMIN_ORDERS_PER_PAGE,
      offset: (page - 1) * ADMIN_ORDERS_PER_PAGE,
    }),
    db.select({ total: count() }).from(orders).where(where),
  ]);
  return { orders: list as AdminOrder[], total };
}

// For the banner on the orders list.
export async function countOrdersNeedingAttention() {
  const [{ total }] = await db.select({ total: count() }).from(orders).where(needsAttention);
  return total;
}

// Clears the flag once a person has refunded or fulfilled the payment by
// hand, keeping the reason in the history. False when it was already clear.
export async function resolveOrderAttention(
  order: Pick<Order, "id" | "attentionReason">,
  note: string,
  actor: AdminEventInput["actor"],
) {
  const rows = await writeWithEvent(
    db
      .update(orders)
      .set({ attentionReason: null })
      .where(and(eq(orders.id, order.id), needsAttention))
      .returning({ id: orders.id }),
    {
      actor,
      entity: "order",
      action: "resolve",
      label: orderReference(order),
      changes: {
        attention: { from: order.attentionReason, to: null },
        ...(note && { note: { from: null, to: note } }),
      },
    },
  );
  return rows.length > 0;
}

export async function getAdminOrder(orderId: string): Promise<AdminOrder | undefined> {
  if (!isOrderId(orderId)) return undefined;
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items, user: { columns: { name: true, email: true } } },
  });
}
