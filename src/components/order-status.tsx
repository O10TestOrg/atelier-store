import type { Order } from "@/lib/orders";

// Same dot + label pattern as StockStatus.
const states = {
  paid: { label: "Confirmed", dot: "bg-success" },
  pending: { label: "Payment processing", dot: "bg-warning" },
  unpaid: { label: "Not paid", dot: "border border-muted" },
};

export function orderState(order: Pick<Order, "status">) {
  return order.status === "paid" || order.status === "pending" ? order.status : "unpaid";
}

export function OrderStatus({ order }: { order: Pick<Order, "status"> }) {
  const { label, dot } = states[orderState(order)];
  return (
    <p className="flex items-center gap-2 text-body-sm">
      <span aria-hidden="true" className={`size-2 rounded-pill ${dot}`} />
      {label}
    </p>
  );
}
