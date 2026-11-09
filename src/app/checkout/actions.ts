"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { CartActionResult } from "@/app/bag/actions";
import { getAppUrl } from "@/lib/app-url";
import { STORE_CURRENCY } from "@/lib/catalog";
import {
  buildCart,
  orderLines,
  readCart,
  reconcileCart,
  subtractLines,
  writeCart,
} from "@/lib/cart";
import { cancelCheckout, lazyReleaseLapsedHolds } from "@/lib/order-sweep";
import {
  StockUnavailableError,
  attachCheckoutSession,
  createPendingOrder,
  releaseOrder,
} from "@/lib/orders";
import {
  clearPendingCheckout,
  readBrowserCheckout,
  setCheckoutReceipt,
  setPendingCheckout,
} from "@/lib/pending-checkout";
import { getCheckoutProducts } from "@/lib/products";
import { consumeCheckoutAttempt } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { readDeliveryCountry, shippingOptions } from "@/lib/shipping";
import { getStripe } from "@/lib/stripe";

// Stripe's minimum session lifetime is 30 minutes; a minute's margin covers
// clock skew. Stock stays reserved for this long if the shopper walks away.
const RESERVATION_MS = 31 * 60 * 1000;

const GENERIC_ERROR = "We couldn’t start checkout. Please try again.";

// Prices, totals and stock all come from the database here. The form fields,
// `expectedTotal` and `expectedCountry`, are what the bag page showed: they're
// never used to price anything, only to stop us charging a total or offering
// delivery the shopper didn't see.
export async function startCheckout(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const expectedTotal = Number(formData.get("expectedTotal"));
  const country = await readDeliveryCountry();
  if (formData.get("expectedCountry") !== country.code) {
    return {
      ok: false,
      message: "Your delivery country changed. Please review your bag before checking out.",
    };
  }

  if (!(await consumeCheckoutAttempt())) {
    return {
      ok: false,
      message: "Too many checkout attempts. Please wait a few minutes and try again.",
    };
  }

  // Settle lapsed holds from other shoppers once this response is sent.
  after(async () => {
    try {
      if ((await lazyReleaseLapsedHolds()) > 0) revalidateTag("products", { expire: 0 });
    } catch (error) {
      console.error("Lazy hold sweep failed", error);
    }
  });

  // One pending checkout per browser: going back from Stripe and checking out
  // again releases the first hold, rather than reserving the pieces twice.
  const previous = await readBrowserCheckout();
  if (previous?.state === "holding") {
    if (await cancelCheckout(previous.order.id)) {
      updateTag("products");
    } else {
      // Stripe couldn't confirm it ended (or it was just paid in another tab).
      // The bag counts that hold as the shopper's, so don't price against
      // stock without it; reconciling now would shrink their bag.
      return {
        ok: false,
        message: "Your previous checkout is still open. Please try again in a moment.",
      };
    }
  } else if (previous?.state === "placed") {
    return {
      ok: false,
      message: "Your previous checkout has just been completed. Reload the bag to see your order.",
    };
  }

  const stored = await readCart();
  const products = await getCheckoutProducts(stored.map((line) => line.slug));
  const bag = buildCart(stored, products);
  const lines = bag.lines
    .filter((line) => line.status !== "unavailable")
    .map((line) => ({
      product: products.find((product) => product.slug === line.product.slug)!,
      quantity: line.quantity,
    }));

  if (lines.length === 0) {
    await writeCart(reconcileCart(stored, products));
    return { ok: false, message: "Nothing in your bag is available to order." };
  }
  if (!Number.isInteger(expectedTotal) || expectedTotal !== bag.subtotal) {
    await writeCart(reconcileCart(stored, products));
    return {
      ok: false,
      message: "Prices or availability changed. Please review your bag before checking out.",
    };
  }

  const user = await getCurrentUser();
  const orderId = randomUUID();
  const expiresAt = new Date(Date.now() + RESERVATION_MS);

  try {
    await createPendingOrder({
      id: orderId,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      lines,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof StockUnavailableError) {
      const fresh = await getCheckoutProducts(stored.map((line) => line.slug));
      await writeCart(reconcileCart(stored, fresh));
      return {
        ok: false,
        message: "Some pieces sold out a moment ago. Your bag has been updated.",
      };
    }
    console.error("Could not create order", error);
    return { ok: false, message: GENERIC_ERROR };
  }
  updateTag("products");

  let url: string | null = null;
  let sessionId: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: lines.map(({ product, quantity }) => ({
          quantity,
          price_data: {
            currency: STORE_CURRENCY,
            unit_amount: product.price,
            product_data: {
              name: product.name,
              description: `${product.colour} · Ref. ${product.reference}`,
              images: [product.image],
            },
          },
        })),
        client_reference_id: orderId,
        metadata: { orderId },
        payment_intent_data: { metadata: { orderId } },
        customer_email: user?.email,
        // Hosted Checkout can't reprice delivery for the address typed, so
        // the address must be in the country the bag priced delivery for.
        shipping_address_collection: { allowed_countries: [country.code] },
        shipping_options: shippingOptions(country, STORE_CURRENCY),
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${getAppUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getAppUrl()}/checkout/cancel?order=${orderId}`,
        integration_identifier: "atelier-bag-qzvkmrth",
      },
      { idempotencyKey: `checkout:${orderId}` },
    );
    sessionId = session.id;
    await attachCheckoutSession(orderId, session.id);
    url = session.url;
  } catch (error) {
    console.error("Could not create Stripe Checkout Session", { orderId, error });
    url = null;
  }

  if (!url) {
    // Don't leave a payable session behind for an order we're about to cancel.
    if (sessionId) {
      await getStripe()
        .checkout.sessions.expire(sessionId)
        .catch((error) => console.error("Could not expire orphaned session", { sessionId, error }));
    }
    if (await releaseOrder(orderId, "canceled")) updateTag("products");
    return { ok: false, message: GENERIC_ERROR };
  }
  await setPendingCheckout(orderId);
  // Outside the try: redirect() works by throwing.
  redirect(url);
}

// For a shopper who paid on Stripe but never came back through
// /checkout/return (closed the tab, lost signal): the bag page calls this when
// it sees the browser's checkout was placed. Takes the bought pieces out of the
// bag, keeps anything added since, and lets this browser see the receipt.
export async function settleCheckout() {
  const checkout = await readBrowserCheckout();
  if (checkout?.state !== "placed") redirect("/bag");

  const { order } = checkout;
  const bought = orderLines(order);
  await writeCart(subtractLines(await readCart(), bought));
  await clearPendingCheckout();
  await setCheckoutReceipt(order.id);
  const session = order.stripeCheckoutSessionId;
  redirect(
    session ? `/bag?checkout=placed&session_id=${encodeURIComponent(session)}` : "/bag?checkout=placed",
  );
}
