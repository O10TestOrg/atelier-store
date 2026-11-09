import { StatusDot, type DotTone } from "@/components/signal";
import type { Order } from "@/features/orders/orders";

// Same dot + label pattern as StockStatus.
const states: Record<"paid" | "pending" | "unpaid", { label: string; tone: DotTone }> = {
  paid: { label: "Confirmed", tone: "success" },
  pending: { label: "Payment processing", tone: "warning" },
  unpaid: { label: "Not paid", tone: "change" },
};

// Staff see the exact status, including checkouts customers never see.
const adminStates: Record<Order["status"], { label: string; tone: DotTone }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Payment failed", tone: "danger" },
  expired: { label: "Expired", tone: "change" },
  canceled: { label: "Canceled", tone: "change" },
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
  const { label, tone } =
    variant === "admin" ? adminStates[order.status] : states[orderState(order)];
  return (
    <p className="flex items-center gap-2 text-body-sm">
      <StatusDot tone={tone} size="md" />
      {label}
    </p>
  );
}
