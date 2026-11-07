import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatus } from "@/components/order-status";
import { formatPrice } from "@/lib/catalog";
import {
  ADMIN_ORDERS_PER_PAGE,
  getAdminOrders,
  isAdminOrderFilter,
  orderReference,
  type AdminOrderFilter,
} from "@/lib/orders";
import { parseInteger } from "@/lib/product-form";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const filters: { value: AdminOrderFilter; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
  { value: "all", label: "All" },
];

const ordersHref = (filter: AdminOrderFilter, page = 1) => {
  const params = new URLSearchParams();
  if (filter !== "completed") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
};

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Orders</h1>
        <p className="mt-4 max-w-prose text-muted">
          Newest first. “Completed” shows the orders customers see: paid, plus payments
          still clearing or failed after checkout. Statuses only change through Stripe.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-96 animate-pulse bg-surface" />}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrderList({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdmin("/admin/orders");

  const params = await searchParams;
  const filter = isAdminOrderFilter(params.status) ? params.status : "completed";
  const page = Math.max(1, parseInteger(params.page) ?? 1);
  const { orders, total } = await getAdminOrders(filter, page);
  const pages = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PER_PAGE));

  return (
    <>
      <nav aria-label="Filter by status" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={ordersHref(f.value)}
            className="link-quiet aria-[current=page]:underline"
            aria-current={filter === f.value ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-6 border-t pt-10 text-muted">No orders match this filter.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-t text-left text-body-sm">
            <caption className="sr-only">Orders, newest first</caption>
            <thead className="text-meta">
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 font-normal">Order</th>
                <th scope="col" className="py-3 pr-4 font-normal">Customer</th>
                <th scope="col" className="py-3 pr-4 font-normal">Status</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Items</th>
                <th scope="col" className="py-3 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order.id} className="border-b align-top">
                    <th scope="row" className="py-4 pr-4 font-normal">
                      <Link href={`/admin/orders/${order.id}`} className="link-quiet">
                        {orderReference(order)}
                      </Link>
                      <p className="mt-1 text-meta">
                        <time dateTime={order.createdAt.toISOString()}>
                          {dateFormat.format(order.createdAt)}
                        </time>
                      </p>
                    </th>
                    <td className="max-w-64 py-4 pr-4">
                      <p className="break-all">{order.email ?? order.user?.email ?? "—"}</p>
                      <p className="mt-1 text-meta">{order.user ? order.user.name : "Guest"}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <OrderStatus order={order} variant="admin" />
                    </td>
                    <td className="py-4 pr-4 text-right tabular-nums">{itemCount}</td>
                    <td className="py-4 text-right tabular-nums">{formatPrice(order.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-4 text-body-sm">
          {page > 1 ? (
            <Link href={ordersHref(filter, page - 1)} className="link-quiet">
              <span aria-hidden="true">←</span> Newer
            </Link>
          ) : (
            <span />
          )}
          <p className="text-meta">
            Page {Math.min(page, pages)} of {pages}
          </p>
          {page < pages ? (
            <Link href={ordersHref(filter, page + 1)} className="link-quiet">
              Older <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
