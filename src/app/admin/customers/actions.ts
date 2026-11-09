"use server";

import { refresh } from "next/cache";
import { getAccountRole, setAccountRole, type Role } from "@/lib/customers";
import type { AdminActionResult } from "@/lib/product-form";
import { assertAdmin } from "@/lib/session";

// Same rules as the other admin actions: check the role first, then validate.
// `setAccountRole` enforces the safety rules in SQL; the checks here only
// pick the message.

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Bound to the account id and the role to give it; both are re-checked.
export async function changeRole(id: string, role: Role): Promise<AdminActionResult> {
  const admin = await assertAdmin();
  if (typeof id !== "string" || !id || (role !== "admin" && role !== "customer")) {
    return { ok: false, message: GENERIC_ERROR };
  }
  if (id === admin.id) return { ok: false, message: "You can’t change your own role." };

  const account = await getAccountRole(id);
  if (!account) return { ok: false, message: "This account no longer exists." };
  if (account.role === role) {
    return { ok: true, message: role === "admin" ? "Already an admin." : "Already a customer." };
  }
  if (role === "admin" && !account.emailVerified) {
    return { ok: false, message: "They need to verify their email before they can be an admin." };
  }

  try {
    if (!(await setAccountRole(id, role, admin, account.email))) {
      return {
        ok: false,
        message:
          role === "customer"
            ? "The store needs at least one other admin first."
            : "Their account changed while you were looking. Reload and try again.",
      };
    }
  } catch (error) {
    console.error("Could not change role", { id, role, error });
    return { ok: false, message: GENERIC_ERROR };
  }
  refresh();
  return {
    ok: true,
    message: role === "admin" ? `${account.name} is now an admin.` : `${account.name} is now a customer.`,
  };
}
