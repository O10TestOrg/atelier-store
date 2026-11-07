import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import type { Order } from "@/lib/orders";

// Items and totals as recorded on the order, not today's catalog prices.
export function OrderSummary({ order }: { order: Order }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <>
      <ul className="border-t">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-6 border-b py-4 text-body-sm">
            <div className="min-w-0">
              <Link href={`/products/${item.slug}`} className="link-quiet">
                {item.name}
              </Link>
              <p className="mt-1 text-meta">
                Ref. {item.reference} · Qty {item.quantity}
              </p>
            </div>
            <p className="tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-3 text-body-sm">
        <dt className="text-muted">
          Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
        </dt>
        <dd className="text-right tabular-nums">{formatPrice(order.subtotal)}</dd>
        <dt className="text-muted">Delivery</dt>
        <dd className="text-right">Complimentary</dd>
      </dl>
      <div className="mt-6 flex items-baseline justify-between border-t border-line-strong pt-4">
        <p>Total</p>
        <p className="text-heading-sm tabular-nums">{formatPrice(order.total)}</p>
      </div>
    </>
  );
}
