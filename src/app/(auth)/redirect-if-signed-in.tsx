import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// Renders nothing; sends signed-in visitors on to their account.
export async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/account");
  return null;
}
