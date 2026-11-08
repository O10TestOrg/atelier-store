import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice } from "@/lib/catalog";

test("drops cents from whole-dollar prices", () => {
  assert.equal(formatPrice(125000), "$1,250");
  assert.equal(formatPrice(0), "$0");
});

test("shows cents when a price has them", () => {
  assert.equal(formatPrice(125050), "$1,250.50");
  assert.equal(formatPrice(125099), "$1,250.99");
  assert.equal(formatPrice(5), "$0.05");
});
