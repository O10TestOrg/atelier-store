import type { Order } from "@/features/orders/orders";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// Stripe sends ISO country codes ("FR"); show the name ("France").
function countryName(code: string | null) {
  if (!code) return null;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// The delivery address collected on Stripe Checkout.
export function OrderAddress({
  order,
  className = "",
}: {
  order: Pick<Order, "shippingName" | "shippingAddress">;
  className?: string;
}) {
  const address = order.shippingAddress;
  if (!address) return null;

  return (
    <address className={`not-italic ${className}`}>
      {order.shippingName && <>{order.shippingName}<br /></>}
      {address.line1}
      {address.line2 && <><br />{address.line2}</>}
      <br />
      {[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}
      <br />
      {countryName(address.country)}
    </address>
  );
}
