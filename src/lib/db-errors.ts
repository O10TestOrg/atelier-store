// Postgres error details from a Drizzle error. Drizzle wraps driver errors, so
// this walks the `cause` chain until it finds a SQLSTATE code.
export function pgError(error: unknown): { code?: string; constraint?: string } {
  for (let e = error; e; e = (e as { cause?: unknown }).cause) {
    if (typeof e !== "object") break;
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (typeof code === "string") {
      return { code, constraint: typeof constraint === "string" ? constraint : undefined };
    }
  }
  return {};
}

export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
// Deleting a row still referenced through an `on delete restrict` foreign key.
export const RESTRICT_VIOLATION = "23001";
export const CHECK_VIOLATION = "23514";
