// Admin history: an append-only record of who changed what. Writes go through
// `writeWithEvent`, which records the event in the same statement as the
// change, so a change can't happen without its row (or the reverse).
import "server-only";
import { and, count, desc, eq, not, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { adminEvents } from "@/db/schema";
import type { AdminEventArea, AdminEventKind } from "@/lib/admin-event-kinds";
import type { FieldChanges } from "@/lib/field-changes";

export type AdminEntity = (typeof adminEvents.$inferSelect)["entity"];
export type AdminEvent = typeof adminEvents.$inferSelect;

export type AdminEventInput = {
  actor: { id: string; email: string };
  entity: AdminEntity;
  action: string;
  // What the entity is called, kept so the row still reads after a delete.
  // SQL is for names read in the statement itself, not from the request.
  label: string | SQL;
  changes?: FieldChanges;
};

// Runs `write`, an INSERT, UPDATE or DELETE ... RETURNING that returns an `id`
// column, and records `event` once for each row it returned. A write that
// matches nothing (a failed compare-and-set) records nothing. Raw rows come
// back with column names and unparsed values.
export async function writeWithEvent<Row extends { id: unknown }>(
  write: SQLWrapper,
  event: AdminEventInput,
): Promise<Row[]> {
  const result = await db.execute<Row>(sql`
    with written as ${write},
    logged as (
      insert into ${adminEvents} (actor_id, actor_email, entity, entity_id, action, label, changes)
      select ${event.actor.id}, ${event.actor.email}, ${event.entity}, written.id::text,
        ${event.action}, ${event.label}, ${JSON.stringify(event.changes ?? {})}::jsonb
      from written
    )
    select * from written
  `);
  return result.rows;
}

// Newest first. Callers must have passed `requireAdmin()`. Uncached.
export async function getEntityHistory(entity: AdminEntity, entityId: string, limit = 50) {
  return db
    .select()
    .from(adminEvents)
    .where(and(eq(adminEvents.entity, entity), eq(adminEvents.entityId, entityId)))
    .orderBy(desc(adminEvents.createdAt), desc(adminEvents.id))
    .limit(limit);
}

export const ADMIN_EVENTS_PER_PAGE = 50;

// `adminEventKind` from `src/lib/admin-event-kinds.ts` in SQL. The coalesces
// keep every condition true or false, so `not(...)` never meets a null.
const statusTo = sql`coalesce(${adminEvents.changes} -> 'status' ->> 'to', '')`;
const roleTo = sql`coalesce(${adminEvents.changes} -> 'role' ->> 'to', '')`;
const isAction = (entity: AdminEntity, action: string) =>
  and(eq(adminEvents.entity, entity), eq(adminEvents.action, action));

const kindWhere = {
  delete: eq(adminEvents.action, "delete"),
  add: or(
    isAction("product", "create"),
    isAction("category", "create"),
    and(isAction("user", "role"), sql`${roleTo} = 'admin'`),
  ),
  publish: or(
    isAction("order", "resolve"),
    and(isAction("product", "status"), sql`${statusTo} = 'active'`),
  ),
  archive: or(
    and(isAction("user", "role"), sql`${roleTo} <> 'admin'`),
    and(isAction("product", "status"), sql`${statusTo} = 'archived'`),
  ),
};

function adminEventKindWhere(kind: AdminEventKind) {
  if (kind !== "edit") return kindWhere[kind];
  return not(or(kindWhere.delete, kindWhere.add, kindWhere.publish, kindWhere.archive)!);
}

export type AdminEventFilters = { kind?: AdminEventKind; area?: AdminEventArea };

export async function getAdminEvents(page: number, { kind, area }: AdminEventFilters = {}) {
  const where = and(
    kind ? adminEventKindWhere(kind) : undefined,
    area ? eq(adminEvents.entity, area) : undefined,
  );
  const [events, [{ total }]] = await Promise.all([
    db
      .select()
      .from(adminEvents)
      .where(where)
      .orderBy(desc(adminEvents.createdAt), desc(adminEvents.id))
      .limit(ADMIN_EVENTS_PER_PAGE)
      .offset((page - 1) * ADMIN_EVENTS_PER_PAGE),
    db.select({ total: count() }).from(adminEvents).where(where),
  ]);
  return { events, total };
}
