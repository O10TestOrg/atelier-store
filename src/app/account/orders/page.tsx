import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatus } from "@/components/order-status";
import { OrderItemThumbs } from "@/components/product-thumb";
import { formatPrice } from "@/lib/catalog";
import { getUserOrders, orderReference } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });

export default function OrdersPage() {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Orders</p>
        <h1 className="mt-4 text-heading">Your orders</h1>
        <p className="mt-4 max-w-prose text-muted">
          Orders you’ve placed while signed in, and guest orders placed with your confirmed email
          address, newest first. Select one for its items and delivery details.
        </p>
      </header>
      <Suspense fallback={<OrderListSkeleton />}>
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
          Orders you place while signed in will appear here, along with guest orders placed with
          your email address once it’s confirmed.
        </p>
        <Link href="/search" className="btn btn-primary mt-8">
          Shop all
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-10 border-t">
      {orders.map((order) => {
        const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
        return (
          <li key={order.id} className="border-b">
            <Link
              href={`/account/orders/${order.id}`}
              className="group flex flex-col gap-3 py-5 sm:grid sm:grid-cols-[minmax(0,1fr)_12rem_7rem_1rem] sm:items-center sm:gap-6"
            >
              <div className="flex min-w-0 items-center gap-4">
                <OrderItemThumbs items={order.items} />
                <div className="min-w-0">
                  <h2 className="text-body-sm">Order {orderReference(order)}</h2>
                  <p className="mt-1 text-meta">
                    <time dateTime={order.createdAt.toISOString()}>
                      {dateFormat.format(order.createdAt)}
                    </time>{" "}
                    · {itemCount} {itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-6 sm:contents">
                <OrderStatus order={order} />
                <p className="text-body-sm tabular-nums sm:text-right">
                  <span className="sr-only">Total </span>
                  {formatPrice(order.total, order.currency)}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="hidden transition-transform group-hover:translate-x-1 sm:block"
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function OrderListSkeleton() {
  return (
    <ul aria-hidden="true" className="mt-10 border-t">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex flex-col gap-3 border-b py-5">
          <div className="h-5 w-40 animate-pulse bg-surface" />
          <div className="h-5 w-full max-w-md animate-pulse bg-surface" />
        </li>
      ))}
    </ul>
  );
}
