import assert from "node:assert/strict";
import { test } from "node:test";
import { likePattern } from "@/lib/sql";

test("likePattern matches anywhere and escapes wildcards", () => {
  assert.equal(likePattern("coat"), "%coat%");
  assert.equal(likePattern("50%_off"), "%50\\%\\_off%");
  assert.equal(likePattern("a\\b"), "%a\\\\b%");
});
