import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice } from "@/lib/catalog";

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
