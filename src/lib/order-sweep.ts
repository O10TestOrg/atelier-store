// Releases stock held by checkouts that will never finish. Stripe's
// `checkout.session.expired` webhook does this normally; the sweep covers what
// it can't: orders that never got a session (the process died between
// reserving stock and creating it) and webhooks that never arrived.
//
// Every release goes through `releaseOrder`, which only acts on pending
// orders, so the sweep, the webhook, cancel and return can all race safely.
// Callers revalidate the "products" tag when these return a positive count.
import "server-only";
import { pruneCheckoutAttempts } from "@/lib/checkout-limit";
import {
  applyCheckoutSession,
  getLapsedPendingOrders,
  getPendingOrder,
  pruneStripeEvents,
  releaseOrder,
} from "@/lib/orders";
import { pruneRestockAlerts, sendRestockAlerts } from "@/lib/restock-alerts";
import { getStripe } from "@/lib/stripe";

// Ends a checkout the shopper walked away from and puts its stock back. Stock
// is released only once Stripe confirms the session is expired, so a payment
// completed in another tab is never undone. Returns whether stock was released.
export async function cancelCheckout(orderId: string) {
  const order = await getPendingOrder(orderId);
  if (!order) return false;
  if (!order.stripeCheckoutSessionId) {
    // Session creation is still in flight, unless the hold has run out: then
    // the process died before creating one, and nothing can pay for it.
    return order.expiresAt < new Date() && (await releaseOrder(order.id, "expired"));
  }

  const stripe = getStripe();
  try {
    await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
  } catch {
    // Already expired or completed; the session's real status decides below.
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
    return session.status === "expired" && (await releaseOrder(order.id, "canceled"));
  } catch (error) {
    // The session still expires on its own and the webhook releases it then.
    console.error("Could not confirm cancelled Checkout Session", { orderId, error });
    return false;
  }
}

// Settles pending orders whose hold has lapsed: releases those without a
// session, and asks Stripe about the rest (expired → release, complete →
// record it as the webhook would have). Returns how many were released.
export async function releaseLapsedHolds(limit: number) {
  const lapsed = await getLapsedPendingOrders(limit);
  let released = 0;

  for (const order of lapsed) {
    try {
      if (!order.stripeCheckoutSessionId) {
        if (await releaseOrder(order.id, "expired")) released++;
        continue;
      }
      const session = await getStripe().checkout.sessions.retrieve(
        order.stripeCheckoutSessionId,
      );
      if (session.status === "expired") {
        if (await releaseOrder(order.id, "expired")) released++;
      } else if (session.status === "complete") {
        await applyCheckoutSession(session);
      }
    } catch (error) {
      console.error("Could not settle lapsed order", { orderId: order.id, error });
    }
  }
  return released;
}

const LAZY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastLazySweep = 0;

// A small sweep piggybacking on checkout traffic, at most every five minutes
// per server instance. The cron route does the thorough version.
export async function lazyReleaseLapsedHolds() {
  if (Date.now() - lastLazySweep < LAZY_SWEEP_INTERVAL_MS) return 0;
  lastLazySweep = Date.now();
  return releaseLapsedHolds(10);
}

// The scheduled sweep (`/api/cron/release-holds`): a bigger batch, plus
// pruning the Stripe event ledger and stale checkout rate-limit windows. It
// also sends back-in-stock alerts, including for stock any other path put
// back (a canceled checkout, the lazy sweep).
export async function scheduledSweep() {
  const released = await releaseLapsedHolds(100);
  await sendRestockAlerts();
  await Promise.all([pruneStripeEvents(), pruneCheckoutAttempts(), pruneRestockAlerts()]);
  return released;
}
