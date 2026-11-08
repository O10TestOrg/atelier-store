import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";

// Renders nothing; sends signed-in visitors on to where they were headed
// (`?next=`, same-origin only), or to their account.
export async function RedirectIfSignedIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getCurrentUser()) redirect(safeRedirectPath((await searchParams).next));
  return null;
}
