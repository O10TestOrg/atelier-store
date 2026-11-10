"use server";

import { refresh } from "next/cache";
import { isOrderId } from "@/lib/ids";
import { getAdminOrder, resolveOrderAttention } from "@/features/orders/orders";
import { READ_ONLY, type AdminActionResult } from "@/features/admin/product-form";
import { assertAdmin, isViewer } from "@/lib/session";

// Orders stay read-only: their status only moves through Stripe. This only
// clears the "needs attention" flag once a person has dealt with the payment.

const NOTE_MAX = 500;

// Bound to the order id, which is re-checked.
export async function markAttentionResolved(
  orderId: string,
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  if (await isViewer()) return READ_ONLY;
  const admin = await assertAdmin();
  if (!isOrderId(orderId)) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  const note = formData.get("note");
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) return { ok: false, message: "Say what you did, like “Refunded in Stripe”." };
  if (text.length > NOTE_MAX) return { ok: false, message: `Keep this under ${NOTE_MAX} characters.` };

  const order = await getAdminOrder(orderId);
  if (!order) return { ok: false, message: "This order no longer exists." };
  if (!order.attentionReason) return { ok: true, message: "Already resolved." };

  try {
    await resolveOrderAttention(order, text, admin);
  } catch (error) {
    console.error("Could not resolve order", { orderId, error });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  refresh();
  return { ok: true, message: "Marked resolved." };
}
