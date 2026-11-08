import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderLinkToken, ORDER_LINK_HOURS, readOrderLinkToken } from "./order-link";

const secret = "test-secret";
const orderId = "0f8fad5b-d9cb-469f-a165-70867728950e";
const now = Date.UTC(2026, 10, 8);

test("a fresh token reads back its order id", () => {
  const token = createOrderLinkToken(orderId, now, secret);
  assert.equal(readOrderLinkToken(token, now, secret), orderId);
});

test("an expired token is rejected", () => {
  const token = createOrderLinkToken(orderId, now, secret);
  const later = now + (ORDER_LINK_HOURS * 60 * 60 + 1) * 1000;
  assert.equal(readOrderLinkToken(token, later, secret), null);
});

test("tampered or foreign tokens are rejected", () => {
  const token = createOrderLinkToken(orderId, now, secret);
  const [, expires, signature] = token.split(".");
  const otherOrder = "1f8fad5b-d9cb-469f-a165-70867728950e";
  assert.equal(readOrderLinkToken(`${otherOrder}.${expires}.${signature}`, now, secret), null);
  assert.equal(readOrderLinkToken(`${orderId}.${Number(expires) + 1}.${signature}`, now, secret), null);
  assert.equal(readOrderLinkToken(token, now, "another-secret"), null);
  assert.equal(readOrderLinkToken(`${token}.extra`, now, secret), null);
  assert.equal(readOrderLinkToken(undefined, now, secret), null);
  assert.equal(readOrderLinkToken("", now, secret), null);
});
