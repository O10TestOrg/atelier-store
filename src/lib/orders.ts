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
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  stripeEvents,
  type OrderStatus,
} from "@/db/schema";
import type { CheckoutProduct } from "@/lib/products";

export type Order = typeof orders.$inferSelect & {
  items: (typeof orderItems.$inferSelect)[];
};

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
// deleted mid-checkout). Drizzle wraps driver errors, so look at the cause too.
function isStockConflict(error: unknown) {
  const codes = new Set(["23514", "23503"]);
  for (let e = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && codes.has(code)) return true;
    if (typeof e !== "object") break;
  }
  return false;
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
        subtotal,
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

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPendingOrder(orderId: string) {
  if (!UUID.test(orderId)) return undefined;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .limit(1);
  return order;
}

// The order a Checkout Session belongs to, cross-checked three ways: metadata,
// client_reference_id and (once attached) the stored session id.
export async function findOrderForSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || !UUID.test(orderId) || session.client_reference_id !== orderId) {
    return null;
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return null;
  }
  return order;
}

// Records a completed Checkout Session. Marks the order paid only when Stripe
// says it's paid and the amount and currency match what we charged. Async
// payment methods complete as `unpaid` first: the order stays pending, and its
// stock stays held, until `async_payment_succeeded` or `_failed` arrives.
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

  if (session.payment_status !== "paid") {
    await db.update(orders).set(details).where(isPending);
    return order.status;
  }

  const [paid] = await db
    .update(orders)
    .set({ ...details, status: "paid", paidAt: new Date() })
    .where(
      and(
        isPending,
        eq(orders.total, session.amount_total ?? -1),
        eq(orders.currency, session.currency ?? ""),
      ),
    )
    .returning({ id: orders.id });
  if (paid) return "paid";

  const [current] = await db
    .select({ status: orders.status, total: orders.total })
    .from(orders)
    .where(eq(orders.id, order.id));
  if (current?.status !== "paid") {
    // Paid, but not for what we expected, or after the order was released.
    // Retrying won't help: flag it for a person to refund or fulfil by hand.
    console.error("Paid Stripe session could not be applied to its order", {
      orderId: order.id,
      sessionId: session.id,
      status: current?.status,
      expected: current?.total,
      received: session.amount_total,
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

export async function getOrderBySessionId(sessionId: string): Promise<Order | undefined> {
  return db.query.orders.findFirst({
    where: eq(orders.stripeCheckoutSessionId, sessionId),
    with: { items: true },
  });
}

// Paid orders, plus pending ones the shopper actually completed on Stripe
// (an async payment still clearing). A completed session has a shipping
// address; an abandoned checkout doesn't, so it isn't listed.
export async function getUserOrders(userId: string): Promise<Order[]> {
  return db.query.orders.findMany({
    where: and(
      eq(orders.userId, userId),
      or(
        eq(orders.status, "paid"),
        and(eq(orders.status, "pending"), isNotNull(orders.shippingAddress)),
      ),
    ),
    with: { items: true },
    orderBy: desc(orders.createdAt),
  });
}
