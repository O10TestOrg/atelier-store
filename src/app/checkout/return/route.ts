import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { writeCart } from "@/lib/cart";
import { applyCheckoutSession, findOrderForSession, releaseOrder } from "@/lib/orders";
import { clearPendingCheckout, setCheckoutReceipt } from "@/lib/pending-checkout";
import { getStripe } from "@/lib/stripe";

const SESSION_ID = /^cs_[A-Za-z0-9_]{1,250}$/;

// Stripe's success_url. A Route Handler rather than a page so it can clear the
// bag cookie. The session id in the URL is only a lookup key: what happens next
// depends on the session as Stripe reports it to us, server to server. That
// also covers a webhook that hasn't arrived yet; the webhook handler is
// idempotent, so whichever runs second is a no-op.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  if (!SESSION_ID.test(sessionId)) redirect("/bag");

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/bag");
  }

  if (session.status === "expired") {
    const order = await findOrderForSession(session);
    if (order && (await releaseOrder(order.id, "expired"))) {
      revalidateTag("products", { expire: 0 });
    }
    redirect("/bag?checkout=expired");
  }
  if (session.status !== "complete") redirect("/bag");

  await applyCheckoutSession(session);
  await writeCart([]);
  await clearPendingCheckout();
  // Lets this browser see the order's address and items on the success page.
  const order = await findOrderForSession(session);
  if (order) await setCheckoutReceipt(order.id);
  redirect(`/checkout/success?session_id=${encodeURIComponent(session.id)}`);
}
