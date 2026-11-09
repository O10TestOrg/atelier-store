"use server";

import { after } from "next/server";
import { consumeRateLimit, ORDER_LOOKUP_LIMIT } from "@/lib/checkout-limit";
import { composeEmail, trySendEmail } from "@/lib/email";
import { createOrderLinkToken, ORDER_LINK_HOURS } from "@/lib/order-link";
import { findOrdersByReference, orderReference } from "@/lib/orders";
import { getAppUrl } from "@/lib/app-url";

export type LookupState = {
  ok: boolean;
  message: string;
  fieldErrors?: { reference?: string; email?: string };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Guest order lookup. Anyone can call it, so the reply never says whether an
// order matched: the link only goes to the email on the order, and emails are
// sent after the response so its timing doesn't tell either.
export async function requestOrderLink(
  _previous: LookupState | null,
  formData: FormData,
): Promise<LookupState> {
  const rawReference = formData.get("reference");
  const rawEmail = formData.get("email");
  const reference =
    typeof rawReference === "string" ? rawReference.replace(/[\s#-]/g, "").toUpperCase() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().slice(0, 254) : "";

  const fieldErrors: LookupState["fieldErrors"] = {};
  if (!/^[0-9A-F]{8}$/.test(reference)) {
    fieldErrors.reference = "Enter the 8-character reference from your confirmation, like 1A2B3C4D.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter the email address you used at checkout.";
  }
  if (fieldErrors.reference || fieldErrors.email) {
    return { ok: false, message: "", fieldErrors };
  }

  if (!(await consumeRateLimit("order-lookup", ORDER_LOOKUP_LIMIT))) {
    return { ok: false, message: "Too many lookups. Please wait a few minutes and try again." };
  }

  const matches = await findOrdersByReference(reference, email);
  if (matches.length > 0) {
    const base = getAppUrl();
    after(async () => {
      for (const order of matches) {
        if (!order.email) continue;
        const url = `${base}/orders/view?token=${encodeURIComponent(createOrderLinkToken(order.id))}`;
        await trySendEmail(
          composeEmail({
            to: order.email,
            subject: `Your Atelier order ${orderReference(order)}`,
            heading: `Order ${orderReference(order)}`,
            paragraphs: ["Here’s the link you asked for to view your order and its delivery details."],
            action: { label: "View your order", url },
            footnote: `The link works for ${ORDER_LINK_HOURS / 24} days. If you didn’t ask for it, you can ignore this email.`,
          }),
        );
      }
    });
  }

  return {
    ok: true,
    message: `If an order matches, we’ve emailed a link to view it to ${email}. It can take a few minutes to arrive.`,
  };
}
