// Per-IP limit on starting checkout. Each start reserves stock for 31 minutes
// and needs no account, so without this a script could make the whole
// catalogue show sold out. The per-browser cap (one pending checkout, see
// `startCheckout`) handles honest repeat clicks; this handles cookie-less ones.
import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { checkoutRateLimits } from "@/db/schema";

export const CHECKOUT_LIMIT = { max: 10, windowMinutes: 10 };

// The first `x-forwarded-for` hop is the client as the hosting proxy saw it
// (Vercel and most platforms overwrite the header). Without a proxy it can be
// spoofed, which only changes which bucket a request counts against.
async function clientIp() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}

// Counts this attempt and says whether it's within the limit. One statement,
// so concurrent attempts can't both slip under it.
export async function consumeCheckoutAttempt() {
  const key = `checkout:${await clientIp()}`;
  const windowExpired = sql`${checkoutRateLimits.windowStart} < now() - make_interval(mins => ${CHECKOUT_LIMIT.windowMinutes})`;
  const [row] = await db
    .insert(checkoutRateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: checkoutRateLimits.key,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${checkoutRateLimits.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then now() else ${checkoutRateLimits.windowStart} end`,
      },
    })
    .returning({ count: checkoutRateLimits.count });
  return (row?.count ?? 1) <= CHECKOUT_LIMIT.max;
}

// Old windows are dead weight; the scheduled sweep clears them.
export async function pruneCheckoutAttempts() {
  await db
    .delete(checkoutRateLimits)
    .where(sql`${checkoutRateLimits.windowStart} < now() - interval '1 day'`);
}
