import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderAddress } from "@/components/order-address";
import { OrderStatus } from "@/components/order-status";
import { OrderSummary } from "@/components/order-summary";
import { getOrderBySessionId, orderReference, type Order } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

// Reached through /checkout/return, which has already synced the order with
// Stripe. This page only reads our order rows; it never changes them.
export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <div className="container-page pt-8 pb-section md:pt-12">
      <Suspense fallback={<ConfirmationSkeleton />}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Confirmation({
  searchParams,
}: Pick<PageProps<"/checkout/success">, "searchParams">) {
  const { session_id: sessionId } = await searchParams;
  const order =
    typeof sessionId === "string" && sessionId.startsWith("cs_")
      ? await getOrderBySessionId(sessionId)
      : undefined;

  if (!order) {
    return (
      <div className="mx-auto max-w-prose text-center">
        <h1 className="text-heading">We couldn’t find that order</h1>
        <p className="mt-4 text-muted">
          If you were charged, your receipt from Stripe has the details. Our client services
          team can help.
        </p>
        <Link href="/" className="btn btn-primary mt-8">
          Return home
        </Link>
      </div>
    );
  }

  const copy = statusCopy(order);
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <header className="lg:col-span-5">
        <p className="text-eyebrow text-muted">Order {orderReference(order)}</p>
        <h1 className="mt-4 text-heading">{copy.title}</h1>
        <div className="mt-6">
          <OrderStatus order={order} />
        </div>
        <p className="mt-4 max-w-prose text-muted">{copy.body}</p>
        {order.shippingAddress && (
          <div className="mt-8 text-body-sm">
            <h2 className="text-eyebrow text-muted">Delivering to</h2>
            <OrderAddress order={order} className="mt-3" />
          </div>
        )}
        <Link href="/collections/new" className="btn btn-primary mt-8">
          Continue shopping
        </Link>
      </header>

      <section aria-labelledby="order-summary" className="lg:col-span-7">
        <div className="bg-surface p-6 md:p-8">
          <h2 id="order-summary" className="mb-6 text-heading-sm">
            Summary
          </h2>
          <OrderSummary order={order} />
        </div>
      </section>
    </div>
  );
}

function statusCopy(order: Order) {
  const email = order.email ? ` at ${order.email}` : "";
  switch (order.status) {
    case "paid":
      return {
        title: "Thank you for your order",
        body: `Your payment is confirmed. We’ll be in touch${email} when your pieces are on their way.`,
      };
    case "pending":
      return {
        title: "We’re confirming your payment",
        body: "Your order is placed and your pieces are held for you. Some payment methods take a few days to clear, and your order is confirmed as soon as the payment does.",
      };
    default:
      return {
        title: "Your payment didn’t go through",
        body: "You haven’t been charged for this order, and the pieces are back on sale. To order them, add them to your bag again.",
      };
  }
}

function ConfirmationSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <div className="h-4 w-1/3 animate-pulse bg-surface" />
        <div className="mt-4 h-10 w-3/4 animate-pulse bg-surface" />
        <div className="mt-4 h-16 animate-pulse bg-surface" />
      </div>
      <div className="h-72 animate-pulse bg-surface lg:col-span-7" />
    </div>
  );
}
