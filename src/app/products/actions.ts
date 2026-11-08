"use server";

import { consumeRateLimit, RESTOCK_ALERT_LIMIT } from "@/lib/checkout-limit";
import { isValidSlug } from "@/lib/cart";
import { getProductAvailability } from "@/lib/products";
import { addRestockAlert } from "@/lib/restock-alerts";

export type RestockAlertResult = { ok: boolean; message: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Email me when it's back" on a sold-out product. No session needed, so the
// slug and email are untrusted, and it's rate-limited per IP. Stock is read
// live: the product page is cached and may be out of date.
export async function requestRestockAlert(
  slug: string,
  _previous: RestockAlertResult,
  formData: FormData,
): Promise<RestockAlertResult> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().slice(0, 254) : "";
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, message: "Enter a valid email address, like name@example.com." };
  }
  if (!isValidSlug(slug)) return { ok: false, message: "This piece is no longer available." };

  if (!(await consumeRateLimit("restock-alert", RESTOCK_ALERT_LIMIT))) {
    return { ok: false, message: "Too many requests. Please wait a few minutes and try again." };
  }

  const product = await getProductAvailability(slug);
  if (!product) return { ok: false, message: "This piece is no longer available." };
  if (product.stock > 0) {
    return {
      ok: true,
      message: `Good news: the ${product.name} is back in stock. Refresh the page to add it to your bag.`,
    };
  }

  try {
    await addRestockAlert(product.id, email);
  } catch (error) {
    console.error("Could not save restock alert", { slug, error });
    return { ok: false, message: "We couldn't save your request. Please try again." };
  }
  return { ok: true, message: `We’ll email ${email} once, when the ${product.name} is back.` };
}
