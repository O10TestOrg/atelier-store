import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { OrderAddress } from "@/components/order-address";
import { OrderStatus } from "@/components/order-status";
import { OrderSummary } from "@/components/order-summary";
import { getAdminOrder, orderReference } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order details",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
});

// Read-only: order status only moves through Stripe.
export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <>
      <Link href="/admin/orders" className="link-quiet text-body-sm text-muted">
        <span aria-hidden="true">←</span> All orders
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

  return (
    <>
      <header className="mt-8">
        <p className="text-eyebrow text-muted">Order details</p>
        <h1 className="mt-4 text-heading">Order {orderReference(order)}</h1>
      </header>

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
              <span className="break-all">{order.email}</span>
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
              <code className="font-mono text-caption break-all">
                {order.stripePaymentIntentId}
              </code>
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
    </>
  );
}

function Time({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time>;
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
