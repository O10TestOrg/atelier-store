import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirectPath } from "@/lib/redirect";

test("keeps same-origin paths", () => {
  assert.equal(safeRedirectPath("/wishlist"), "/wishlist");
  assert.equal(safeRedirectPath("/account/orders?page=2#top"), "/account/orders?page=2#top");
});

test("falls back for anything that could leave the site", () => {
  for (const value of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "", undefined, null, 42]) {
    assert.equal(safeRedirectPath(value), "/account", String(value));
  }
});

test("uses the given fallback", () => {
  assert.equal(safeRedirectPath("//evil.com", "/bag"), "/bag");
});
