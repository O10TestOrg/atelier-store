import type { Metadata } from "next";
import Link from "next/link";
import { OrderLookupForm } from "@/features/orders/order-lookup-form";

export const metadata: Metadata = {
  title: "Find your order",
  description: "Get a link to an Atelier order you placed as a guest.",
  robots: { index: false },
};

export default function OrderLookupPage() {
  return (
    <section className="section container-form">
      <header className="text-center">
        <p className="text-eyebrow text-muted">Orders</p>
        <h1 className="mt-4 text-heading">Find your order</h1>
        <p className="mt-4 text-muted">
          Enter your order reference and checkout email. We’ll email you a link to the order.
        </p>
      </header>

      <div className="mt-10">
        <OrderLookupForm />
      </div>

      <p className="mt-8 border-t pt-8 text-center text-body-sm text-muted">
        Have an account?{" "}
        <Link href="/sign-in?next=%2Faccount%2Forders" className="link text-foreground">
          Sign in to see your orders
        </Link>
        . Guest orders join your account once its email address is confirmed.
      </p>
    </section>
  );
}
