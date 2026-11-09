import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { markAttentionResolved } from "@/features/admin/actions/orders";
import { HistoryList } from "@/features/admin/components/history-list";
import { ResolveAttentionForm } from "@/features/admin/components/resolve-attention-form";
import { OrderAddress } from "@/features/orders/order-address";
import { OrderStatus } from "@/features/orders/order-status";
import { OrderSummary } from "@/features/orders/order-summary";
import { Notice } from "@/components/signal";
import { getEntityHistory } from "@/features/admin/admin-events";
import { formatDateTime } from "@/lib/dates";
import { getAdminOrder, orderReference } from "@/features/orders/orders";
import { requireAdmin } from "@/lib/session";
import { stripePaymentUrl } from "@/lib/stripe";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Order details",
};

// Read-only: order status only moves through Stripe. The one admin write is
// clearing "needs attention" once a payment has been dealt with by hand.
export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <>
      <Link href="/admin/orders" className="link-quiet text-body-sm text-muted">
        <ArrowLeftIcon /> All orders
      </Link>
      <Suspense fallback={<div aria-hidden="true" className="mt-8 h-96 animate-pulse bg-surface" />}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${encodeURIComponent(id)}`);
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const history = await getEntityHistory("order", order.id);

  return (
    <>
      <header className="mt-8">
        <p className="text-eyebrow text-muted">Order details</p>
        <h1 className="mt-4 text-heading">Order {orderReference(order)}</h1>
      </header>

      {order.attentionReason && (
        <Notice tone="warning" className="mt-8">
          <p className="font-medium">Needs attention</p>
          <p className="mt-1 max-w-prose">{order.attentionReason}</p>
          {order.stripePaymentIntentId && (
            <p className="mt-2">
              <a
                href={stripePaymentUrl(order.stripePaymentIntentId)}
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                Open the payment in Stripe<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
          <ResolveAttentionForm action={markAttentionResolved.bind(null, order.id)} />
        </Notice>
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-12">
        <dl className="self-start border-t text-body-sm">
          <Row label="Status">
            <OrderStatus order={order} variant="admin" />
          </Row>
          <Row label="Placed">
            <Time date={order.createdAt} />
          </Row>
          {order.paidAt && (
            <Row label="Paid">
              <Time date={order.paidAt} />
            </Row>
          )}
          {order.status === "pending" && (
            <Row label="Held until">
              <Time date={order.expiresAt} />
            </Row>
          )}
          <Row label="Customer">
            {order.user ? (
              <>
                {order.user.name}
                <p className="mt-1 break-all text-meta">{order.user.email}</p>
              </>
            ) : (
              "Guest"
            )}
          </Row>
          {order.email && (
            <Row label="Receipt email">
              <a href={`mailto:${order.email}`} className="link-quiet break-all">
                {order.email}
              </a>
              <p className="mt-1 text-meta">
                <Link
                  href={`/admin/orders?status=all&q=${encodeURIComponent(order.email)}`}
                  className="link-quiet"
                >
                  All orders from this email
                </Link>
              </p>
            </Row>
          )}
          {order.shippingAddress && (
            <Row label="Delivering to">
              <OrderAddress order={order} />
            </Row>
          )}
          <Row label="Order id">
            <code className="font-mono text-caption break-all">{order.id}</code>
          </Row>
          {order.stripeCheckoutSessionId && (
            <Row label="Stripe session">
              <code className="font-mono text-caption break-all">
                {order.stripeCheckoutSessionId}
              </code>
            </Row>
          )}
          {order.stripePaymentIntentId && (
            <Row label="Payment intent">
              <a
                href={stripePaymentUrl(order.stripePaymentIntentId)}
                target="_blank"
                rel="noreferrer"
                className="link-quiet"
              >
                <code className="font-mono text-caption break-all">
                  {order.stripePaymentIntentId}
                </code>
                <span className="sr-only"> in Stripe (opens in a new tab)</span>
              </a>
            </Row>
          )}
        </dl>

        <section aria-labelledby="order-summary" className="bg-surface p-6 md:p-8">
          <h2 id="order-summary" className="mb-6 text-heading-sm">
            Summary
          </h2>
          <OrderSummary order={order} />
        </section>
      </div>

      {history.length > 0 && (
        <section aria-labelledby="order-history" className="mt-16">
          <h2 id="order-history" className="mb-6 text-heading-sm">
            History
          </h2>
          <HistoryList events={history} categoryNames={new Map()} />
        </section>
      )}
    </>
  );
}

function Time({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{formatDateTime(date)}</time>;
}

// Same label/value rows as the customer order page.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6">
      <dt className="text-meta sm:w-32 sm:shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
