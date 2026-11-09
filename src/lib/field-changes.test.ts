import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BIG_PRICE_CHANGE, diffFields, priceChangeRatio } from "@/lib/field-changes";

describe("diffFields", () => {
  test("lists only the fields that changed, with both values", () => {
    const before = { name: "Tote", price: 125_000, details: ["Leather"], isNew: false };
    assert.deepEqual(
      diffFields(before, { name: "Tote", price: 99_000, details: ["Leather"], isNew: true }),
      { price: { from: 125_000, to: 99_000 }, isNew: { from: false, to: true } },
    );
  });

  test("compares arrays by content", () => {
    assert.deepEqual(diffFields({ details: ["a", "b"] }, { details: ["a", "b"] }), {});
    assert.deepEqual(diffFields({ details: ["a", "b"] }, { details: ["b", "a"] }), {
      details: { from: ["a", "b"], to: ["b", "a"] },
    });
  });

  test("ignores fields that weren't submitted", () => {
    assert.deepEqual(diffFields({ name: "Tote", slug: "tote" }, { name: "Tote" }), {});
  });
});

describe("priceChangeRatio", () => {
  test("flags a dropped zero as a big change", () => {
    // £1,250 typed as £125.
    assert.ok(priceChangeRatio(125_000, 12_500) > BIG_PRICE_CHANGE);
    // £125 typed as £1,250.
    assert.ok(priceChangeRatio(12_500, 125_000) > BIG_PRICE_CHANGE);
  });

  test("lets ordinary changes through", () => {
    assert.ok(priceChangeRatio(125_000, 110_000) <= BIG_PRICE_CHANGE);
    assert.ok(priceChangeRatio(125_000, 187_500) <= BIG_PRICE_CHANGE);
  });
});
