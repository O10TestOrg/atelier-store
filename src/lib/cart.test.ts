import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_LINES,
  MAX_QUANTITY,
  buildCart,
  creditHeldStock,
  parseCart,
  reconcileCart,
  subtractLines,
} from "@/lib/cart";
import type { Product } from "@/lib/products";

const product = (slug: string, stock: number, price = 10_000) =>
  ({ slug, stock, price }) as Product;

describe("parseCart", () => {
  test("returns an empty bag for missing, malformed or non-array values", () => {
    assert.deepEqual(parseCart(undefined), []);
    assert.deepEqual(parseCart("not json"), []);
    assert.deepEqual(parseCart('{"slug":"a","quantity":1}'), []);
  });

  test("drops invalid entries and duplicate slugs", () => {
    const value = JSON.stringify([
      { slug: "a", quantity: 2 },
      { slug: "a", quantity: 5 },
      { slug: "", quantity: 1 },
      { slug: "b", quantity: 0 },
      { slug: "c", quantity: 1.5 },
      { slug: "d", quantity: "3" },
      null,
      { slug: "e", quantity: 1 },
    ]);
    assert.deepEqual(parseCart(value), [
      { slug: "a", quantity: 2 },
      { slug: "e", quantity: 1 },
    ]);
  });

  test("caps quantity per line and the number of lines", () => {
    assert.deepEqual(parseCart(JSON.stringify([{ slug: "a", quantity: 999 }])), [
      { slug: "a", quantity: MAX_QUANTITY },
    ]);
    const many = Array.from({ length: MAX_LINES + 5 }, (_, i) => ({ slug: `p${i}`, quantity: 1 }));
    assert.equal(parseCart(JSON.stringify(many)).length, MAX_LINES);
  });
});

describe("buildCart", () => {
  test("prices lines from products and clamps them to stock", () => {
    const bag = buildCart(
      [
        { slug: "a", quantity: 2 },
        { slug: "b", quantity: 5 },
        { slug: "c", quantity: 1 },
        { slug: "gone", quantity: 1 },
      ],
      [product("a", 10, 1_250), product("b", 3, 2_000), product("c", 0, 5_000)],
    );

    assert.deepEqual(
      bag.lines.map(({ product, quantity, status, lineTotal }) => [product.slug, quantity, status, lineTotal]),
      [
        ["a", 2, "ok", 2_500],
        ["b", 3, "reduced", 6_000],
        ["c", 0, "unavailable", 0],
      ],
    );
    assert.equal(bag.subtotal, 8_500);
    assert.equal(bag.itemCount, 5);
    assert.equal(bag.removedCount, 1);
  });
});

describe("reconcileCart", () => {
  test("drops deleted products, clamps to stock and keeps sold-out lines", () => {
    assert.deepEqual(
      reconcileCart(
        [
          { slug: "a", quantity: 4 },
          { slug: "b", quantity: 2 },
          { slug: "gone", quantity: 1 },
        ],
        [product("a", 3), product("b", 0)],
      ),
      [
        { slug: "a", quantity: 3 },
        { slug: "b", quantity: 2 },
      ],
    );
  });
});

describe("creditHeldStock", () => {
  test("counts this browser's held pieces as available again", () => {
    const products = [product("a", 0), product("b", 3), product("c", 1)];
    const credited = creditHeldStock(products, [
      { slug: "a", quantity: 1 },
      { slug: "b", quantity: 2 },
    ]);
    assert.deepEqual(
      credited.map((p) => [p.slug, p.stock]),
      [["a", 1], ["b", 5], ["c", 1]],
    );
    assert.equal(products[0].stock, 0, "doesn't mutate its input");
  });

  test("keeps a held sold-out piece in the bag at its full quantity", () => {
    const bag = buildCart(
      [{ slug: "a", quantity: 2 }],
      creditHeldStock([product("a", 0)], [{ slug: "a", quantity: 2 }]),
    );
    assert.equal(bag.lines[0].status, "ok");
    assert.equal(bag.lines[0].quantity, 2);
  });
});

describe("subtractLines", () => {
  test("removes what an order bought and keeps pieces added since", () => {
    assert.deepEqual(
      subtractLines(
        [
          { slug: "a", quantity: 2 },
          { slug: "b", quantity: 1 },
          { slug: "c", quantity: 3 },
        ],
        [
          { slug: "a", quantity: 2 },
          { slug: "c", quantity: 1 },
          { slug: "z", quantity: 1 },
        ],
      ),
      [
        { slug: "b", quantity: 1 },
        { slug: "c", quantity: 2 },
      ],
    );
  });

  test("never leaves a negative or zero line", () => {
    assert.deepEqual(subtractLines([{ slug: "a", quantity: 1 }], [{ slug: "a", quantity: 3 }]), []);
  });
});
