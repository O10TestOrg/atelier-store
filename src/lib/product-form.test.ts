import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseProductForm } from "@/lib/product-form";

function form(price: string) {
  const data = new FormData();
  data.set("name", "Field Bomber");
  data.set("reference", "fb-01");
  data.set("colour", "Olive");
  data.set("image", "https://images.unsplash.com/photo-123-abc?w=2400&q=80");
  data.set("imageAlt", "An olive bomber jacket");
  data.set("description", "A bomber jacket.");
  data.set("categoryId", "1");
  data.set("price", price);
  return data;
}

describe("parseProductForm price", () => {
  test("converts dollars as typed to integer cents", () => {
    for (const [typed, cents] of [
      ["1250", 125_000],
      ["1250.5", 125_050],
      ["1250.50", 125_050],
      ["$1,250.05", 125_005],
      ["0.99", 99],
    ] as const) {
      const result = parseProductForm(form(typed), "edit");
      assert.ok(result.ok, typed);
      assert.equal(result.data.price, cents, typed);
    }
  });

  test("rejects prices that aren't dollars and cents", () => {
    for (const typed of ["12.345", "-5", "abc", "1e3", "1000000.01"]) {
      const result = parseProductForm(form(typed), "edit");
      assert.ok(!result.ok, typed);
      assert.ok(result.fieldErrors.price, typed);
    }
  });

  test("asks for a price when it's empty", () => {
    const result = parseProductForm(form(""), "edit");
    assert.ok(!result.ok);
    assert.equal(result.fieldErrors.price, "Enter a price.");
  });
});
