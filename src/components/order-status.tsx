import type { Order } from "@/lib/orders";

// Same dot + label pattern as StockStatus.
const states = {
  paid: { label: "Confirmed", dot: "bg-success" },
  pending: { label: "Payment processing", dot: "bg-warning" },
  unpaid: { label: "Not paid", dot: "bg-change" },
};

// Staff see the exact status, including checkouts customers never see.
const adminStates: Record<Order["status"], { label: string; dot: string }> = {
  paid: { label: "Paid", dot: "bg-success" },
  pending: { label: "Pending", dot: "bg-warning" },
  failed: { label: "Payment failed", dot: "bg-danger" },
  expired: { label: "Expired", dot: "bg-change" },
  canceled: { label: "Canceled", dot: "bg-change" },
};

export function orderState(order: Pick<Order, "status">) {
  return order.status === "paid" || order.status === "pending" ? order.status : "unpaid";
}

export function OrderStatus({
  order,
  variant = "customer",
}: {
  order: Pick<Order, "status">;
  variant?: "customer" | "admin";
}) {
  const { label, dot } =
    variant === "admin" ? adminStates[order.status] : states[orderState(order)];
  return (
    <p className="flex items-center gap-2 text-body-sm">
      <span aria-hidden="true" className={`size-2 rounded-pill transition-colors ${dot}`} />
      {label}
    </p>
  );
}
