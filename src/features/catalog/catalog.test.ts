import assert from "node:assert/strict";
import { test } from "node:test";
import { LOW_STOCK, formatPrice, getStockState, normalizeSearchQuery } from "@/features/catalog/catalog";

test("prices in pounds and drops pence from whole-pound prices", () => {
  assert.equal(formatPrice(125000), "£1,250");
  assert.equal(formatPrice(0), "£0");
});

test("shows pence when a price has them", () => {
  assert.equal(formatPrice(125050), "£1,250.50");
  assert.equal(formatPrice(125099), "£1,250.99");
  assert.equal(formatPrice(5), "£0.05");
});

test("formats an order in the currency it was taken in", () => {
  assert.equal(formatPrice(125000, "usd"), "US$1,250");
  assert.equal(formatPrice(125050, "gbp"), "£1,250.50");
});

test("stock state at the edges", () => {
  assert.equal(getStockState({ stock: 0 }), "out-of-stock");
  assert.equal(getStockState({ stock: -1 }), "out-of-stock");
  assert.equal(getStockState({ stock: 1 }), "low-stock");
  assert.equal(getStockState({ stock: LOW_STOCK }), "low-stock");
  assert.equal(getStockState({ stock: LOW_STOCK + 1 }), "in-stock");
});

test("search queries are trimmed, collapsed and capped", () => {
  assert.equal(normalizeSearchQuery("  wool \n  coat "), "wool coat");
  assert.equal(normalizeSearchQuery("a".repeat(150)).length, 100);
  assert.equal(normalizeSearchQuery(["coat"]), "");
});
