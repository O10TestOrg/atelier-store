// Data Access Layer for auth state. Pages, Server Actions and Route Handlers
// read the session through here, never through `auth.api` directly.
//
// These read request headers, so render callers must sit inside <Suspense>.
// Server Actions and Route Handlers must check for themselves: proxy.ts only
// checks that a cookie exists, and doesn't cover Server Functions at all.
import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  createdAt: Date;
};

// Deduped per request, never stored across requests, so sign-out and role
// changes take effect on the next request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, role, createdAt } = session.user;
  return {
    id,
    name,
    email,
    role: role === "admin" ? "admin" : "customer",
    createdAt: new Date(createdAt),
  };
});

export async function requireUser(returnTo = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

// Non-admins get a 404 rather than a 403, so the admin area isn't advertised.
export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") notFound();
  return user;
}

export class AuthorizationError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "AuthorizationError";
  }
}

// For admin Server Actions and Route Handlers: call it first, before reading
// input or touching data. Throws instead of redirecting, so a forged request
// fails outright.
export async function assertAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new AuthorizationError();
  return user;
}
