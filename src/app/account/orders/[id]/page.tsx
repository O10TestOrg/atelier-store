import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { OrderAddress } from "@/features/orders/order-address";
import { OrderStatus } from "@/features/orders/order-status";
import { OrderSummary } from "@/features/orders/order-summary";
import { formatDate } from "@/lib/dates";
import { getUserOrder, orderReference, type Order } from "@/features/orders/orders";
import { requireUser } from "@/lib/session";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
};

// Private to the signed-in customer, so nothing is prerendered past the back
// link: the session, params and order are all read behind <Suspense>.
export default function OrderDetailPage({ params }: PageProps<"/account/orders/[id]">) {
  return (
    <>
      <Link href="/account/orders" className="link-quiet text-body-sm text-muted">
        <ArrowLeftIcon /> All orders
      </Link>
      <Suspense fallback={<OrderDetailSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/account/orders/[id]">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${encodeURIComponent(id)}`);
  const order = await getUserOrder(user.id, id);
  if (!order) notFound();

  return (
    <>
      <header className="mt-8">
        <p className="text-eyebrow text-muted">Order details</p>
        <h1 className="mt-4 text-heading">Order {orderReference(order)}</h1>
      </header>

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-12">
        <dl className="self-start border-t text-body-sm">
          <Row label="Placed">
            <time dateTime={order.createdAt.toISOString()}>
              {formatDate(order.createdAt)}
            </time>
          </Row>
          <Row label="Payment">
            <OrderStatus order={order} />
            <p className="mt-1 text-meta">{paymentNote(order)}</p>
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

// Same label/value rows as the account details page.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6">
      <dt className="text-meta sm:w-32 sm:shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

// Only orders completed on Stripe reach this page (see `getUserOrder`): paid,
// still clearing, or failed after completion.
function paymentNote(order: Order) {
  switch (order.status) {
    case "paid":
      return order.paidAt ? `Paid ${formatDate(order.paidAt)}` : "Paid";
    case "pending":
      return "Some payments take a few days to clear. We’re holding your pieces until then.";
    default:
      return "Your payment didn’t go through. You haven’t been charged.";
  }
}

function OrderDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-8 h-4 w-32 animate-pulse bg-surface" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse bg-surface" />
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-12">
        <div className="h-48 animate-pulse bg-surface" />
        <div className="h-72 animate-pulse bg-surface" />
      </div>
    </div>
  );
}
