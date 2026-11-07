import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getPendingOrder, releaseOrder } from "@/lib/orders";
import { clearPendingCheckout, readPendingCheckout } from "@/lib/pending-checkout";
import { getStripe } from "@/lib/stripe";

// Stripe's cancel_url. Ends the session now, rather than when it expires, so
// the stock it held goes back on sale straight away. Only the browser that
// started the checkout can do this (the pending_checkout cookie must match).
// Stock is released only if Stripe confirms the session is expired, so a
// payment completed in another tab is never undone.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order") ?? "";
  const pending = await readPendingCheckout();
  const order = pending === orderId ? await getPendingOrder(orderId) : undefined;

  if (order?.stripeCheckoutSessionId) {
    const stripe = getStripe();
    try {
      await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
    } catch {
      // Already expired or completed; the session's real status decides below.
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (session.status === "expired" && (await releaseOrder(order.id, "canceled"))) {
        revalidateTag("products", { expire: 0 });
      }
    } catch (error) {
      // The session still expires on its own and the webhook releases it then.
      console.error("Could not confirm cancelled Checkout Session", { orderId, error });
    }
  }

  if (pending === orderId) await clearPendingCheckout();
  redirect("/bag?checkout=canceled");
}
