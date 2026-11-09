import assert from "node:assert/strict";
import { test } from "node:test";
import { UNIQUE_VIOLATION, pgError } from "@/lib/db-errors";

test("pgError finds the SQLSTATE however deeply Drizzle wraps it", () => {
  const driver = { code: UNIQUE_VIOLATION, constraint: "products_slug_unique" };
  const wrapped = new Error("Failed query", { cause: new Error("wrapper", { cause: driver }) });
  assert.deepEqual(pgError(wrapped), { code: UNIQUE_VIOLATION, constraint: "products_slug_unique" });
  assert.deepEqual(pgError({ code: "23503", constraint: 7 }), { code: "23503", constraint: undefined });
});

test("pgError returns nothing for errors without a code", () => {
  assert.deepEqual(pgError(new Error("network")), {});
  assert.deepEqual(pgError("boom"), {});
  assert.deepEqual(pgError(null), {});
});
