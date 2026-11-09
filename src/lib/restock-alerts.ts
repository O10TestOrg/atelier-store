// Back-in-stock alerts. Shoppers ask on a sold-out product page; the email
// goes once the product has stock again, whichever way it came back (an admin
// restock, or a checkout's hold being released). Senders call
// `sendRestockAlerts` right after those changes, and the scheduled sweep calls
// it too, so nothing waits longer than one sweep interval.
import "server-only";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { restockAlerts } from "@/db/schema";
import { composeEmail, trySendEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";

export async function addRestockAlert(productId: number, email: string) {
  await db
    .insert(restockAlerts)
    .values({ productId, email: email.toLowerCase() })
    // Asking again after an earlier alert was sent re-arms it.
    .onConflictDoUpdate({
      target: [restockAlerts.productId, restockAlerts.email],
      set: { notifiedAt: null, createdAt: sql`now()` },
    });
}

// Claims due alerts before sending, in one statement, so two senders running
// at once never email the same person twice. A failed send isn't retried:
// the shopper can ask again, and one missed alert beats a flood of repeats.
export async function sendRestockAlerts(limit = 100) {
  const result = await db.execute<{ email: string; name: string; slug: string }>(sql`
    with due as (
      select restock_alerts.id from restock_alerts
      join products on products.id = restock_alerts.product_id
      where restock_alerts.notified_at is null and products.stock > 0
        and products.status = 'active'
      order by restock_alerts.id
      limit ${limit}
      for update of restock_alerts skip locked
    ), claimed as (
      update restock_alerts set notified_at = now()
      from due where restock_alerts.id = due.id
      returning restock_alerts.email, restock_alerts.product_id
    )
    select claimed.email, products.name, products.slug
    from claimed join products on products.id = claimed.product_id
  `);
  if (result.rows.length === 0) return 0;

  const base = getAppUrl();
  for (const alert of result.rows) {
    await trySendEmail(
      composeEmail({
        to: alert.email,
        subject: `${alert.name} is back in stock`,
        heading: `${alert.name} is back`,
        paragraphs: [
          `You asked us to tell you when the ${alert.name} was available again. It’s back in stock now, while it lasts.`,
        ],
        action: { label: "View the piece", url: `${base}/products/${alert.slug}` },
        footnote: "This was a one-off alert: we won’t email you about this piece again unless you ask.",
      }),
    );
  }
  return result.rows.length;
}

// Sent alerts are only kept long enough to stop accidental repeats.
export async function pruneRestockAlerts(days = 30) {
  await db
    .delete(restockAlerts)
    .where(
      and(
        isNotNull(restockAlerts.notifiedAt),
        lt(restockAlerts.notifiedAt, sql`now() - make_interval(days => ${days})`),
      ),
    );
}
