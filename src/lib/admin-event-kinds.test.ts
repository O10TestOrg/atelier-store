import assert from "node:assert/strict";
import { test } from "node:test";
import { adminEventKind } from "./admin-event-kinds";

const event = (entity: string, action: string, changes = {}) => ({ entity, action, changes });

test("adminEventKind sorts each admin change", () => {
  assert.equal(adminEventKind(event("product", "create")), "add");
  assert.equal(adminEventKind(event("category", "create")), "add");
  assert.equal(adminEventKind(event("product", "update")), "edit");
  assert.equal(adminEventKind(event("product", "stock")), "edit");
  assert.equal(adminEventKind(event("category", "rename")), "edit");
  assert.equal(adminEventKind(event("product", "delete")), "delete");
  assert.equal(adminEventKind(event("category", "delete")), "delete");
  assert.equal(adminEventKind(event("order", "resolve")), "publish");
});

test("adminEventKind reads status and role changes", () => {
  const status = (to: string) => event("product", "status", { status: { from: "draft", to } });
  assert.equal(adminEventKind(status("active")), "publish");
  assert.equal(adminEventKind(status("archived")), "archive");
  assert.equal(adminEventKind(status("draft")), "edit");

  const role = (to: string) => event("user", "role", { role: { from: "", to } });
  assert.equal(adminEventKind(role("admin")), "add");
  assert.equal(adminEventKind(role("customer")), "archive");
});

test("adminEventKind treats unknown actions as edits", () => {
  assert.equal(adminEventKind(event("product", "something-new")), "edit");
});
