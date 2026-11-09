// Admin history: an append-only record of who changed what. Writes go through
// `writeWithEvent`, which records the event in the same statement as the
// change, so a change can't happen without its row (or the reverse).
import "server-only";
import { and, count, desc, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { adminEvents } from "@/db/schema";
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

export async function getAdminEvents(page: number) {
  const [events, [{ total }]] = await Promise.all([
    db
      .select()
      .from(adminEvents)
      .orderBy(desc(adminEvents.createdAt), desc(adminEvents.id))
      .limit(ADMIN_EVENTS_PER_PAGE)
      .offset((page - 1) * ADMIN_EVENTS_PER_PAGE),
    db.select({ total: count() }).from(adminEvents),
  ]);
  return { events, total };
}
