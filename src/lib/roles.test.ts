import assert from "node:assert/strict";
import { test } from "node:test";
import { displayEmail, isDemoEmail, toRole } from "@/lib/roles";

test("unknown roles read as customer", () => {
  assert.equal(toRole("admin"), "admin");
  assert.equal(toRole("viewer"), "viewer");
  for (const value of ["customer", "Admin", "", null, undefined, 1]) {
    assert.equal(toRole(value), "customer", String(value));
  }
});

test("viewers see real addresses masked", () => {
  assert.equal(displayEmail("jane.doe@gmail.com", true), "j•••@gmail.com");
  assert.equal(displayEmail("jane.doe@gmail.com", false), "jane.doe@gmail.com");
  assert.equal(displayEmail("not-an-email", true), "•••");
});

test("seeded demo addresses stay readable", () => {
  assert.equal(displayEmail("amara@atelier.example", true), "amara@atelier.example");
  assert.equal(isDemoEmail("Amara@Atelier.Example"), true);
  assert.equal(isDemoEmail("amara@atelier.example.com"), false);
  assert.equal(isDemoEmail(null), false);
});
