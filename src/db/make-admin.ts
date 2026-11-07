// Gives an existing user the admin role. Run with `pnpm db:make-admin <email>`.
// Pass `--revoke` to demote them back to customer.
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { user } from "./schema";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"));
  if (!email) throw new Error("Usage: pnpm db:make-admin <email> [--revoke]");

  // Imported after the env is loaded, since `db` reads DATABASE_URL on import.
  const { db } = await import("./index");
  const role = revoke ? "customer" : "admin";

  const updated = await db
    .update(user)
    .set({ role })
    .where(eq(user.email, email.toLowerCase()))
    .returning({ email: user.email });

  if (updated.length === 0) throw new Error(`No user with email ${email}`);
  console.log(`${updated[0].email} is now ${role}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
