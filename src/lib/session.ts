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
import { toRole, type UserRole } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  // A viewer sees the admin area but can't change anything (the public demo
  // account). Writes still need `admin`.
  role: UserRole;
  createdAt: Date;
};

// Deduped per request, never stored across requests, so sign-out and role
// changes take effect on the next request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, emailVerified, role, createdAt } = session.user;
  return {
    id,
    name,
    email,
    emailVerified,
    role: toRole(role),
    createdAt: new Date(createdAt),
  };
});

export async function requireUser(returnTo = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

// For admin pages, which only read: viewers pass too. Everyone else gets a
// 404 rather than a 403, so the admin area isn't advertised.
export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "admin" && user.role !== "viewer") notFound();
  return user;
}

// Admin actions call this before `assertAdmin()` and return `READ_ONLY`, so a
// viewer gets a message instead of the error page. `assertAdmin()` still
// refuses them on its own.
export async function isViewer() {
  return (await getCurrentUser())?.role === "viewer";
}

export class AuthorizationError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "AuthorizationError";
  }
}

// For admin Server Actions and Route Handlers: call it first, before reading
// input or touching data. Admins only; viewers are refused. Throws instead of
// redirecting, so a forged request fails outright.
export async function assertAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") throw new AuthorizationError();
  return user;
}
