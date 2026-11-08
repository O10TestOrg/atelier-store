// Per-IP limit on starting checkout. Each start reserves stock for 31 minutes
// and needs no account, so without this a script could make the whole
// catalogue show sold out. The per-browser cap (one pending checkout, see
// `startCheckout`) handles honest repeat clicks; this handles cookie-less ones.
//
// The same counters, under their own key prefix, limit the other anonymous
// forms that send email: the guest order lookup and back-in-stock alerts.
import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { checkoutRateLimits } from "@/db/schema";

type Limit = { max: number; windowMinutes: number };

export const CHECKOUT_LIMIT: Limit = { max: 10, windowMinutes: 10 };
export const ORDER_LOOKUP_LIMIT: Limit = { max: 5, windowMinutes: 10 };
export const RESTOCK_ALERT_LIMIT: Limit = { max: 10, windowMinutes: 10 };

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
export async function consumeRateLimit(scope: string, limit: Limit) {
  const key = `${scope}:${await clientIp()}`;
  const windowExpired = sql`${checkoutRateLimits.windowStart} < now() - make_interval(mins => ${limit.windowMinutes})`;
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
  return (row?.count ?? 1) <= limit.max;
}

export const consumeCheckoutAttempt = () => consumeRateLimit("checkout", CHECKOUT_LIMIT);

// Old windows are dead weight; the scheduled sweep clears them.
export async function pruneCheckoutAttempts() {
  await db
    .delete(checkoutRateLimits)
    .where(sql`${checkoutRateLimits.windowStart} < now() - interval '1 day'`);
}
