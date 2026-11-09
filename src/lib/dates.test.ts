import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, formatDateTime, formatShortDateTime } from "@/lib/dates";

test("times are UK time whatever the server's zone", () => {
  // 13:05 UTC is 14:05 BST in summer and 13:05 GMT in winter.
  assert.equal(formatDateTime(new Date("2026-07-01T13:05:00Z")), "1 July 2026 at 14:05");
  assert.equal(formatShortDateTime(new Date("2026-12-01T13:05:00Z")), "1 Dec 2026, 13:05");
});

test("dates fall on the UK day", () => {
  // Late evening UTC on 30 June is already 1 July in London.
  assert.equal(formatDate(new Date("2026-06-30T23:30:00Z")), "1 July 2026");
});
