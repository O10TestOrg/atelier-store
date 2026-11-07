import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatus } from "@/components/order-status";
import { OrderSummary } from "@/components/order-summary";
import { getUserOrders, orderReference } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false },
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default function OrdersPage() {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Orders</p>
        <h1 className="mt-4 text-heading">Your orders</h1>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-72 animate-pulse bg-surface" />}>
        <OrderList />
      </Suspense>
    </>
  );
}

async function OrderList() {
  const user = await requireUser("/account/orders");
  const orders = await getUserOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="mt-10 border-t pt-10">
        <p className="text-heading-sm">No orders yet</p>
        <p className="mt-2 max-w-prose text-muted">
          Orders you place while signed in will appear here.
        </p>
        <Link href="/collections/new" className="btn btn-primary mt-8">
          Shop new arrivals
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-10 flex flex-col gap-8">
      {orders.map((order) => (
        <li key={order.id} className="bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="text-heading-sm">Order {orderReference(order)}</h2>
              <p className="mt-1 text-meta">
                Placed{" "}
                <time dateTime={order.createdAt.toISOString()}>
                  {dateFormat.format(order.createdAt)}
                </time>
              </p>
            </div>
            <OrderStatus order={order} />
          </div>
          <OrderSummary order={order} />
        </li>
      ))}
    </ul>
  );
}
