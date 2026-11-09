// Accounts, for the admin Customers page. Callers must have passed
// `requireAdmin()` (pages) or `assertAdmin()` (actions) first. Uncached.
// Role changes take effect on the user's next request: sessions don't cache
// the role (`getCurrentUser`).
import "server-only";
import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, user } from "@/db/schema";
import { writeWithEvent, type AdminEventInput } from "@/lib/admin-events";
import { likePattern } from "@/lib/products";

export type Role = (typeof user.$inferSelect)["role"];

export const ADMIN_CUSTOMERS_PER_PAGE = 50;

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  createdAt: Date;
  orderCount: number;
};

export async function getAdminCustomers(query: { q?: string; role?: Role; page: number }) {
  const q = query.q?.trim();
  const where = and(
    query.role ? eq(user.role, query.role) : undefined,
    q ? or(ilike(user.email, likePattern(q)), ilike(user.name, likePattern(q))) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        // Orders customers can see: paid ones (abandoned checkouts aren't
        // orders to them).
        orderCount: sql<number>`count(${orders.id}) filter (where ${orders.status} = 'paid')`.mapWith(
          Number,
        ),
      })
      .from(user)
      .leftJoin(orders, eq(orders.userId, user.id))
      .where(where)
      .groupBy(user.id)
      .orderBy(desc(sql`${user.role} = 'admin'`), desc(user.createdAt), asc(user.id))
      .limit(ADMIN_CUSTOMERS_PER_PAGE)
      .offset((query.page - 1) * ADMIN_CUSTOMERS_PER_PAGE),
    db.select({ total: count() }).from(user).where(where),
  ]);
  return { customers: rows as AdminCustomer[], total };
}

export async function getAccountRole(id: string) {
  const [row] = await db
    .select({ name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row;
}

// One statement each way, so the rules can't be raced:
// - promoting needs a verified email, so nobody can sign up with a staff
//   address they don't own and be promoted by mistake;
// - demoting needs another admin to remain. The admin rows are locked first,
//   so two admins demoting each other at once can't leave the store with none.
// Neither touches the acting admin's own account. Returns false on a miss.
export async function setAccountRole(
  id: string,
  role: Role,
  actor: AdminEventInput["actor"],
  label: string,
) {
  const from: Role = role === "admin" ? "customer" : "admin";
  const write =
    role === "admin"
      ? db
          .update(user)
          .set({ role })
          .where(
            and(eq(user.id, id), ne(user.id, actor.id), eq(user.role, from), eq(user.emailVerified, true)),
          )
          .returning({ id: user.id })
      : db
          .update(user)
          .set({ role })
          .where(
            and(
              eq(user.id, id),
              ne(user.id, actor.id),
              eq(user.role, from),
              sql`(select count(*) from (select 1 from ${user} where ${user.role} = 'admin' for update) as admins) > 1`,
            ),
          )
          .returning({ id: user.id });

  const rows = await writeWithEvent(write, {
    actor,
    entity: "user",
    action: "role",
    label,
    changes: { role: { from, to: role } },
  });
  return rows.length > 0;
}
