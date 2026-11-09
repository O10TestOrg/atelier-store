import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { scheduledSweep } from "@/features/checkout/order-sweep";

// Scheduled sweep of lapsed stock holds (see `src/features/checkout/order-sweep.ts`). Call it
// every 5–15 minutes with `Authorization: Bearer $CRON_SECRET`; Vercel Cron
// sends that header itself. Without CRON_SECRET the route stays closed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !matches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const released = await scheduledSweep();
  if (released > 0) revalidateTag("products", { expire: 0 });
  return Response.json({ released });
}

function matches(received: string | null, expected: string) {
  const a = Buffer.from(received ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
