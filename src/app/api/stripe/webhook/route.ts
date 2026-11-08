import { revalidateTag } from "next/cache";
import { after } from "next/server";
import type Stripe from "stripe";
import {
  applyCheckoutSession,
  findOrderForSession,
  isEventProcessed,
  markEventProcessed,
  releaseOrder,
} from "@/lib/orders";
import { sendRestockAlerts } from "@/lib/restock-alerts";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

// Stripe → order status. The signature is the only thing that makes a request
// trustworthy, so verify it before reading anything. Handlers are idempotent;
// the event ledger just saves work on redeliveries. Errors return 500 so
// Stripe retries (for up to three days).
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // Outside the try: missing config is our bug (500), not a bad request.
  const stripe = getStripe();
  const secret = getWebhookSecret();
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (await isEventProcessed(event.id)) return new Response(null, { status: 200 });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await applyCheckoutSession(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
      await release(event.data.object, "failed");
      break;
    case "checkout.session.expired":
      await release(event.data.object, "expired");
      break;
  }

  await markEventProcessed(event);
  return new Response(null, { status: 200 });
}

async function release(session: Stripe.Checkout.Session, status: "failed" | "expired") {
  const order = await findOrderForSession(session);
  if (!order) {
    console.error("Stripe session has no matching order", { sessionId: session.id });
    return;
  }
  // Route Handlers can't use updateTag; expire immediately instead.
  if (await releaseOrder(order.id, status)) {
    revalidateTag("products", { expire: 0 });
    // A released hold can bring a sold-out piece back.
    after(() => sendRestockAlerts());
  }
}
