import type { FieldChanges } from "@/lib/field-changes";

// What kind of change an admin event is, for the history's glyphs and the
// activity filters. `adminEventKindWhere` in `src/lib/admin-events.ts` is the
// same rules in SQL; keep the two in step.

export const adminEventKinds = ["add", "publish", "edit", "archive", "delete"] as const;
export type AdminEventKind = (typeof adminEventKinds)[number];

export const isAdminEventKind = (value: unknown): value is AdminEventKind =>
  adminEventKinds.includes(value as AdminEventKind);

export const adminEventAreas = ["product", "category", "user", "order"] as const;
export type AdminEventArea = (typeof adminEventAreas)[number];

export const isAdminEventArea = (value: unknown): value is AdminEventArea =>
  adminEventAreas.includes(value as AdminEventArea);

type EventShape = { entity: string; action: string; changes: FieldChanges };

export function adminEventKind({ entity, action, changes }: EventShape): AdminEventKind {
  const key = `${entity}.${action}`;
  const statusTo = changes.status?.to;
  const roleTo = changes.role?.to;
  if (action === "delete") return "delete";
  if (key === "product.create" || key === "category.create") return "add";
  if (key === "user.role") return roleTo === "admin" ? "add" : "archive";
  if (key === "order.resolve") return "publish";
  if (key === "product.status" && statusTo === "active") return "publish";
  if (key === "product.status" && statusTo === "archived") return "archive";
  return "edit";
}
