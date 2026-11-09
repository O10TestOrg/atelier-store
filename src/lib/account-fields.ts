// Limits and checks for the fields people type in: sign-up, account details,
// the guest order lookup and restock alerts. Pure, so the client forms and
// the server (Better Auth, Server Actions) share one copy.

// 128 is Better Auth's default maximum; `emailAndPassword` in src/lib/auth.ts
// passes both limits.
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 100;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

// Form input as an email to check: trimmed, capped, "" for anything else.
export const normalizeEmail = (raw: unknown) =>
  typeof raw === "string" ? raw.trim().slice(0, MAX_EMAIL_LENGTH) : "";

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email);
