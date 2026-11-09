// Checks for ids that arrive from URLs, forms and Stripe, before they reach a
// query. Product and category ids are integers: see `isValidId` in
// src/features/admin/product-form.ts.

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_ID = /^cs_[A-Za-z0-9_]{1,250}$/;

export const isOrderId = (value: unknown): value is string =>
  typeof value === "string" && ORDER_ID.test(value);

// Branded so a failed check doesn't narrow a plain string to `never`.
export type CheckoutSessionId = string & { readonly __brand: "CheckoutSessionId" };

export const isCheckoutSessionId = (value: unknown): value is CheckoutSessionId =>
  typeof value === "string" && CHECKOUT_SESSION_ID.test(value);
