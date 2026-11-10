// Account roles. A viewer can open every admin page but change nothing: it's
// the public demo login. Imported by the schema, so no `@/` imports here.

export const userRoles = ["customer", "viewer", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export function toRole(role: unknown): UserRole {
  return role === "admin" || role === "viewer" ? role : "customer";
}

// `pnpm db:seed-demo` creates its accounts and orders on this domain.
export const DEMO_EMAIL_DOMAIN = "atelier.example";

// Real visitors can sign up and shop on the demo, and everyone shares the
// viewer login, so viewers see their addresses masked ("j•••@gmail.com").
// Seeded addresses stay readable.
export function displayEmail(email: string, viewer: boolean) {
  if (!viewer || isDemoEmail(email)) return email;
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}

export function isDemoEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
