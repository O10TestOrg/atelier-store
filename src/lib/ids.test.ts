import assert from "node:assert/strict";
import { test } from "node:test";
import { isCheckoutSessionId, isOrderId } from "@/lib/ids";

test("order ids are UUIDs", () => {
  assert.equal(isOrderId("0f8fad5b-d9cb-469f-a165-70867728950e"), true);
  assert.equal(isOrderId("0F8FAD5B-D9CB-469F-A165-70867728950E"), true);
  for (const value of ["", "1", "0f8fad5b-d9cb-469f-a165-70867728950", "../etc", 42, null, undefined]) {
    assert.equal(isOrderId(value), false, String(value));
  }
});

test("checkout session ids start cs_ and stay short", () => {
  assert.equal(isCheckoutSessionId("cs_test_a1B2c3"), true);
  for (const value of ["cs_", "pi_123", "cs_test a", `cs_${"a".repeat(251)}`, ["cs_1"], undefined]) {
    assert.equal(isCheckoutSessionId(value), false, String(value));
  }
});
