import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AdminPager,
  AdminSearch,
  listHref,
  pageCount,
  pageParam,
  param,
} from "@/features/admin/components/list-controls";
import { OrderStatus } from "@/features/orders/order-status";
import { OrderItemThumbs } from "@/features/catalog/product-thumb";
import { Notice, SignalIcon } from "@/components/signal";
import { formatPrice } from "@/features/catalog/catalog";
import { formatShortDateTime } from "@/lib/dates";
import {
  ADMIN_ORDERS_PER_PAGE,
  countOrdersNeedingAttention,
  getAdminOrders,
  isAdminOrderFilter,
  orderReference,
  type AdminOrderFilter,
} from "@/features/orders/orders";
import { displayEmail, isDemoEmail } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders",
};

const filters: { value: AdminOrderFilter; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "attention", label: "Needs attention" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
  { value: "all", label: "All" },
];

const ordersHref = (filter: AdminOrderFilter, page = 1, q = "") =>
  listHref("/admin/orders", {
    status: filter === "completed" ? undefined : filter,
    q,
    page,
  });

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <header>
        <p className="text-eyebrow text-muted">Admin</p>
        <h1 className="mt-4 text-heading">Orders</h1>
        <p className="mt-4 max-w-prose text-muted">
          Newest first. “Completed” is what customers see. Statuses change{" "}
          <strong>only through Stripe</strong>.
        </p>
      </header>
      <Suspense fallback={<div aria-hidden="true" className="mt-10 h-96 animate-pulse bg-surface" />}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrderList({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const { role } = await requireAdmin("/admin/orders");
  const viewer = role === "viewer";

  const params = await searchParams;
  const status = param(params.status);
  const filter = isAdminOrderFilter(status) ? status : "completed";
  const page = pageParam(params.page);
  const q = param(params.q).slice(0, 200);
  const [{ orders, total }, attention] = await Promise.all([
    getAdminOrders(filter, page, q),
    countOrdersNeedingAttention(),
  ]);
  const pages = pageCount(total, ADMIN_ORDERS_PER_PAGE);

  return (
    <>
      {attention > 0 && filter !== "attention" && (
        <Notice tone="warning" className="mt-8">
          {attention === 1 ? "1 order needs" : `${attention} orders need`} attention: Stripe
          took a payment the order couldn’t accept.{" "}
          <Link href={ordersHref("attention")} className="link">
            Review {attention === 1 ? "it" : "them"}
          </Link>
        </Notice>
      )}

      <div className="mt-8">
        <AdminSearch
          action="/admin/orders"
          label="Search orders"
          placeholder="Email, name, reference or Stripe id (pi_…, cs_…)"
          defaultValue={q}
          keep={{ status: filter === "completed" ? undefined : filter }}
        />
      </div>

      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={ordersHref(f.value, 1, q)}
            className="link-quiet aria-[current=page]:underline"
            aria-current={filter === f.value ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-6 border-t pt-10 text-muted">
          {q ? "No orders match this search." : "No orders match this filter."}
        </p>
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
                          {formatShortDateTime(order.createdAt)}
                        </time>
                      </p>
                    </th>
                    <td className="max-w-64 py-4 pr-4">
                      {viewer && !isDemoEmail(customerEmail(order)) && customerEmail(order) ? (
                        <p className="break-all">{displayEmail(customerEmail(order), viewer)}</p>
                      ) : customerEmail(order) ? (
                        <Link
                          href={ordersHref("all", 1, customerEmail(order))}
                          className="link-quiet break-all"
                          title="All orders from this email"
                        >
                          {customerEmail(order)}
                        </Link>
                      ) : (
                        <p>—</p>
                      )}
                      <p className="mt-1 text-meta">{order.user ? order.user.name : "Guest"}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <OrderStatus order={order} variant="admin" />
                      {order.attentionReason && (
                        <p className="mt-1 flex items-center gap-1.5 text-caption">
                          <SignalIcon tone="warning" size="caption" />
                          Needs attention
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-3">
                        <OrderItemThumbs items={order.items} />
                        <span className="tabular-nums">{itemCount}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right tabular-nums">{formatPrice(order.total, order.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager
        page={page}
        pages={pages}
        href={(p) => ordersHref(filter, p, q)}
        newer="Newer"
        older="Older"
      />
    </>
  );
}

const customerEmail = (order: { email: string | null; user: { email: string } | null }) =>
  order.email ?? order.user?.email ?? "";
