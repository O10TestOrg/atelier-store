import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { OrderAddress } from "@/components/order-address";
import { OrderStatus } from "@/components/order-status";
import { OrderSummary } from "@/components/order-summary";
import { formatDate } from "@/lib/dates";
import { readOrderLinkToken } from "@/lib/order-link";
import { getLinkedOrder, orderReference } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

// Opened from the link the guest order lookup emails. The signed token is the
// only credential, so an invalid or expired one shows the same page as an
// unknown order.
export default function OrderViewPage({ searchParams }: PageProps<"/orders/view">) {
  return (
    <section className="section container-page">
      <Suspense fallback={<OrderViewSkeleton />}>
        <OrderView searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function OrderView({ searchParams }: Pick<PageProps<"/orders/view">, "searchParams">) {
  const { token } = await searchParams;
  // The expiry check reads the clock, so it must run per request.
  await connection();
  const orderId = readOrderLinkToken(token);
  const order = orderId ? await getLinkedOrder(orderId) : undefined;

  if (!order) {
    return (
      <div className="mx-auto max-w-prose text-center">
        <p className="text-eyebrow text-muted">Orders</p>
        <h1 className="mt-4 text-heading">This link has expired</h1>
        <p className="mt-4 text-muted">
          Order links work for a few days. Ask for a new one with your order reference and email.
        </p>
        <Link href="/orders/lookup" className="btn btn-primary mt-8">
          Find your order
        </Link>
      </div>
    );
  }

  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Order details</p>
        <h1 className="mt-4 text-heading">Order {orderReference(order)}</h1>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <dl className="self-start border-t text-body-sm">
          <Row label="Placed">
            <time dateTime={order.createdAt.toISOString()}>{formatDate(order.createdAt)}</time>
          </Row>
          <Row label="Payment">
            <OrderStatus order={order} />
          </Row>
          {order.email && (
            <Row label="Email">
              <span className="break-all">{order.email}</span>
            </Row>
          )}
          {order.shippingAddress && (
            <Row label="Delivering to">
              <OrderAddress order={order} />
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

      <p className="mt-8 max-w-prose text-body-sm text-muted">
        Questions about this order? Quote reference {orderReference(order)} when you{" "}
        <Link href="/help/contact" className="link text-foreground">
          contact client services
        </Link>
        .
      </p>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6">
      <dt className="text-meta sm:w-32 sm:shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function OrderViewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-32 animate-pulse bg-surface" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse bg-surface" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="h-48 animate-pulse bg-surface" />
        <div className="h-72 animate-pulse bg-surface" />
      </div>
    </div>
  );
}
