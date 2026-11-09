import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidEmail, normalizeEmail } from "@/lib/account-fields";

test("normalizeEmail trims, caps and ignores non-strings", () => {
  assert.equal(normalizeEmail("  name@example.com \n"), "name@example.com");
  assert.equal(normalizeEmail("a".repeat(300)).length, 254);
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(["name@example.com"]), "");
});

test("isValidEmail wants one @ and a dotted domain", () => {
  assert.equal(isValidEmail("name@example.com"), true);
  for (const value of ["", "name", "name@example", "@example.com", "na me@example.com", "a@b@c.com"]) {
    assert.equal(isValidEmail(value), false, value);
  }
});
