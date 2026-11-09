import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_WISHLIST, isValidSlug, parseWishlist } from "@/lib/cookies";

test("isValidSlug bounds slugs without judging them", () => {
  assert.equal(isValidSlug("wool-coat"), true);
  assert.equal(isValidSlug(""), false);
  assert.equal(isValidSlug("a".repeat(201)), false);
  assert.equal(isValidSlug(42), false);
});

test("parseWishlist drops bad input, duplicates and anything past the cap", () => {
  assert.deepEqual(parseWishlist(undefined), []);
  assert.deepEqual(parseWishlist("not json"), []);
  assert.deepEqual(parseWishlist('{"slug":"a"}'), []);
  assert.deepEqual(parseWishlist(JSON.stringify(["a", "b", "a", 7, "", null])), ["a", "b"]);
  const many = Array.from({ length: MAX_WISHLIST + 10 }, (_, i) => `piece-${i}`);
  assert.equal(parseWishlist(JSON.stringify(many)).length, MAX_WISHLIST);
});
