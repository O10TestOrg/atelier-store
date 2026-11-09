// Before/after diffs for the admin history (`src/features/admin/admin-events.ts`). Pure,
// so it can be tested without a database.

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

// The fields of `after` whose value differs from `before`. Arrays and other
// JSON values compare by content.
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): FieldChanges {
  const changes: FieldChanges = {};
  for (const key of Object.keys(after)) {
    const from = before[key] ?? null;
    const to = after[key] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

// How far a price moved, as a fraction of the old one (0.5 = 50%).
export function priceChangeRatio(from: number, to: number) {
  if (from <= 0) return to > 0 ? Infinity : 0;
  return Math.abs(to - from) / from;
}

// A price that moves by more than this needs a second, confirmed save.
export const BIG_PRICE_CHANGE = 0.5;
