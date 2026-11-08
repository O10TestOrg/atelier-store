import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { cancelCheckout } from "@/lib/order-sweep";
import { clearPendingCheckout, readPendingCheckout } from "@/lib/pending-checkout";

// Stripe's cancel_url. Ends the session now, rather than when it expires, so
// the stock it held goes back on sale straight away. Only the browser that
// started the checkout can do this (the pending_checkout cookie must match).
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order") ?? "";
  const pending = await readPendingCheckout();

  if (pending === orderId) {
    if (await cancelCheckout(orderId)) revalidateTag("products", { expire: 0 });
    await clearPendingCheckout();
  }
  redirect("/bag?checkout=canceled");
}
