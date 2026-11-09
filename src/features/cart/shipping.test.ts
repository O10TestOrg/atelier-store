import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { COUNTRIES, RATES, findCountry, formatDays, shippingOptions } from "@/features/cart/shipping";

describe("delivery zones", () => {
  test("offers the cheapest rate first in every zone", () => {
    for (const rates of Object.values(RATES)) {
      const amounts = rates.map((rate) => rate.amount);
      assert.deepEqual(amounts, [...amounts].sort((a, b) => a - b));
    }
  });

  test("puts the UK first and only knows listed countries", () => {
    assert.equal(COUNTRIES[0].code, "GB");
    assert.equal(findCountry("FR")?.zone, "europe");
    assert.equal(findCountry("US")?.zone, "world");
    assert.equal(findCountry("fr"), undefined);
    assert.equal(findCountry("XX"), undefined);
    assert.equal(findCountry(undefined), undefined);
  });

  test("describes delivery times in working days", () => {
    assert.equal(formatDays({ name: "", amount: 0, minDays: 1, maxDays: 1 }), "1 working day");
    assert.equal(formatDays({ name: "", amount: 0, minDays: 2, maxDays: 3 }), "2–3 working days");
  });

  test("builds Stripe rates in the store currency with estimates", () => {
    const [standard, nextDay] = shippingOptions(findCountry("GB")!, "gbp");
    assert.deepEqual(standard.shipping_rate_data?.fixed_amount, { amount: 0, currency: "gbp" });
    assert.equal(nextDay.shipping_rate_data?.fixed_amount?.amount, 1500);
    assert.deepEqual(nextDay.shipping_rate_data?.delivery_estimate?.maximum, {
      unit: "business_day",
      value: 1,
    });
    assert.equal(shippingOptions(findCountry("JP")!, "gbp").length, 1);
  });
});
