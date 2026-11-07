"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import type { CartActionResult } from "@/app/bag/actions";
import { buildCart, readCart, reconcileCart, writeCart } from "@/lib/cart";
import {
  StockUnavailableError,
  attachCheckoutSession,
  createPendingOrder,
  releaseOrder,
} from "@/lib/orders";
import { setPendingCheckout } from "@/lib/pending-checkout";
import { getCheckoutProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/session";
import { getAppUrl, getStripe } from "@/lib/stripe";

// Stripe's minimum session lifetime is 30 minutes; a minute's margin covers
// clock skew. Stock stays reserved for this long if the shopper walks away.
const RESERVATION_MS = 31 * 60 * 1000;

const SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "IE", "FR", "DE", "IT", "ES", "NL", "BE", "CH", "SE", "DK", "AU", "JP"];

const GENERIC_ERROR = "We couldn’t start checkout. Please try again.";

// Prices, totals and stock all come from the database here. The only form
// field, `expectedTotal`, is the total the bag page showed: it's never used to
// price anything, only to stop us charging a total the shopper didn't see.
export async function startCheckout(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const expectedTotal = Number(formData.get("expectedTotal"));

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

  let url: string | null;
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: lines.map(({ product, quantity }) => ({
          quantity,
          price_data: {
            currency: "usd",
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
        shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: "Complimentary delivery",
              fixed_amount: { amount: 0, currency: "usd" },
            },
          },
        ],
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${getAppUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getAppUrl()}/checkout/cancel?order=${orderId}`,
        integration_identifier: "atelier-bag-qzvkmrth",
      },
      { idempotencyKey: `checkout:${orderId}` },
    );
    await attachCheckoutSession(orderId, session.id);
    url = session.url;
  } catch (error) {
    console.error("Could not create Stripe Checkout Session", { orderId, error });
    url = null;
  }

  if (!url) {
    if (await releaseOrder(orderId, "canceled")) updateTag("products");
    return { ok: false, message: GENERIC_ERROR };
  }
  await setPendingCheckout(orderId, expiresAt);
  // Outside the try: redirect() works by throwing.
  redirect(url);
}
