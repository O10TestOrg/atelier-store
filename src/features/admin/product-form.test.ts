import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  isAllowedImageUrl,
  isValidId,
  parseCategoryName,
  parseCategorySlug,
  parseInteger,
  parseProductForm,
  parseStock,
  toPounds,
} from "@/features/admin/product-form";

const UPLOAD_HOST = "abc123.public.blob.vercel-storage.com";
const noUploads = { uploadHost: null };

function form(price: string, extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("name", "Field Bomber");
  data.set("reference", "fb-01");
  data.set("colour", "Olive");
  data.set("image", "https://images.unsplash.com/photo-123-abc?w=2400&q=80");
  data.set("imageAlt", "An olive bomber jacket");
  data.set("description", "A bomber jacket.");
  data.set("categoryId", "1");
  data.set("price", price);
  for (const [name, value] of Object.entries(extra)) data.set(name, value);
  return data;
}

describe("parseProductForm price", () => {
  test("converts pounds as typed to integer pence", () => {
    for (const [typed, pence] of [
      ["1250", 125_000],
      ["1250.5", 125_050],
      ["1250.50", 125_050],
      ["£1,250.05", 125_005],
      ["0.99", 99],
      ["0.50", 50],
    ] as const) {
      const result = parseProductForm(form(typed), "edit", noUploads);
      assert.ok(result.ok, typed);
      assert.equal(result.data.price, pence, typed);
    }
  });

  test("rejects prices that aren't pounds and pence", () => {
    for (const typed of ["12.345", "-5", "abc", "1e3", "1000000.01", "$1,250"]) {
      const result = parseProductForm(form(typed), "edit", noUploads);
      assert.ok(!result.ok, typed);
      assert.ok(result.fieldErrors.price, typed);
    }
  });

  test("rejects prices under 50p, including free", () => {
    for (const typed of ["0", "0.00", "0.49"]) {
      const result = parseProductForm(form(typed), "edit", noUploads);
      assert.ok(!result.ok, typed);
      assert.equal(result.fieldErrors.price, "Enter at least £0.50.", typed);
    }
  });

  test("asks for a price when it's empty", () => {
    const result = parseProductForm(form(""), "edit", noUploads);
    assert.ok(!result.ok);
    assert.equal(result.fieldErrors.price, "Enter a price.");
  });
});

describe("parseProductForm slug", () => {
  test("ignores the slug on edit once it's fixed", () => {
    const result = parseProductForm(form("10", { slug: "renamed" }), "edit", noUploads);
    assert.ok(result.ok);
    assert.equal(result.data.slug, undefined);
  });

  test("reads and validates the slug on edit while it's editable", () => {
    const ok = parseProductForm(form("10", { slug: "field-bomber" }), "edit", {
      ...noUploads,
      slugEditable: true,
    });
    assert.ok(ok.ok);
    assert.equal(ok.data.slug, "field-bomber");

    const bad = parseProductForm(form("10", { slug: "Field Bomber" }), "edit", {
      ...noUploads,
      slugEditable: true,
    });
    assert.ok(!bad.ok);
    assert.ok(bad.fieldErrors.slug);
  });
});

describe("isAllowedImageUrl", () => {
  test("accepts sample Unsplash URLs with or without uploads", () => {
    const url = "https://images.unsplash.com/photo-123-abc?w=2400&q=80";
    assert.ok(isAllowedImageUrl(url, null));
    assert.ok(isAllowedImageUrl(url, UPLOAD_HOST));
  });

  test("accepts uploads only from this store's Blob host, under products/", () => {
    const upload = `https://${UPLOAD_HOST}/products/bomber-Xy12.jpg`;
    assert.ok(isAllowedImageUrl(upload, UPLOAD_HOST));
    assert.ok(!isAllowedImageUrl(upload, null), "uploads off");
    for (const url of [
      "https://other.public.blob.vercel-storage.com/products/bomber.jpg",
      `https://${UPLOAD_HOST}/elsewhere/bomber.jpg`,
      `https://${UPLOAD_HOST}/products/bomber.jpg?x=1`,
      `https://${UPLOAD_HOST}/products/a/b.jpg`,
      `http://${UPLOAD_HOST}/products/bomber.jpg`,
      `https://${UPLOAD_HOST}.evil.com/products/bomber.jpg`,
    ]) {
      assert.ok(!isAllowedImageUrl(url, UPLOAD_HOST), url);
    }
  });
});

describe("parseCategorySlug", () => {
  test("reserves new, which is the New arrivals page", () => {
    assert.ok(parseCategorySlug("new").error);
    assert.equal(parseCategorySlug(" newsletters ").slug, "newsletters");
    assert.equal(parseCategorySlug("bags").slug, "bags");
  });
});

describe("number parsing", () => {
  test("parseInteger takes whole non-negative numbers only", () => {
    assert.equal(parseInteger(" 42 "), 42);
    assert.equal(parseInteger("0"), 0);
    for (const value of ["", "-1", "1.5", "1e3", "abc", 42, undefined]) {
      assert.equal(parseInteger(value), null, String(value));
    }
    assert.equal(parseInteger("11", 10), null);
    assert.equal(parseInteger("99999999999999999999"), null);
  });

  test("parseStock caps at the stock limit", () => {
    assert.equal(parseStock("5"), 5);
    assert.equal(parseStock("100000000"), null);
  });

  test("isValidId wants a positive safe integer", () => {
    assert.equal(isValidId(1), true);
    for (const value of [0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1, null]) {
      assert.equal(isValidId(value), false, String(value));
    }
  });

  test("toPounds drops .00 and keeps pence", () => {
    assert.equal(toPounds(125000), "1250");
    assert.equal(toPounds(125050), "1250.50");
    assert.equal(toPounds(5), "0.05");
  });
});

describe("parseCategoryName", () => {
  test("trims and collapses spaces", () => {
    assert.deepEqual(parseCategoryName("  Knit   wear "), { name: "Knit wear" });
  });

  test("refuses empty and over-long names", () => {
    assert.ok(parseCategoryName("   ").error);
    assert.ok(parseCategoryName(7).error);
    assert.ok(parseCategoryName("a".repeat(200)).error);
  });
});
