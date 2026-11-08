import assert from "node:assert/strict";
import { test } from "node:test";
import { safeRedirectPath } from "@/lib/redirect";

test("keeps same-origin paths", () => {
  assert.equal(safeRedirectPath("/wishlist"), "/wishlist");
  assert.equal(safeRedirectPath("/account/orders?page=2#top"), "/account/orders?page=2#top");
  // Encoded characters stay encoded, so they can't become a second slash.
  assert.equal(safeRedirectPath("/%09/evil.com"), "/%09/evil.com");
});

test("falls back for anything that could leave the site", () => {
  for (const value of [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/a/..//evil.com",
    "/\t\\evil.com",
    "\\\\evil.com",
    "evil.com",
    "",
    undefined,
    null,
    42,
  ]) {
    assert.equal(safeRedirectPath(value), "/account", String(value));
  }
});

test("uses the given fallback", () => {
  assert.equal(safeRedirectPath("//evil.com", "/bag"), "/bag");
});
