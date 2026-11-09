// The store's public origin, for Stripe return URLs, links in emails and the
// upload origin check. Pure (reads only `process.env`), so it's testable.
//
// On Vercel each deployment knows its own URLs, so a preview links back to
// itself rather than to production: its cart and checkout cookies live on the
// preview's host, and a return to production would strand them.
type Env = Record<string, string | undefined>;

const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

export function resolveAppUrl(env: Env = process.env) {
  const url =
    env.VERCEL_ENV === "preview"
      ? https(env.VERCEL_BRANCH_URL ?? env.VERCEL_URL)
      : (env.APP_URL ?? https(env.VERCEL_PROJECT_PRODUCTION_URL));
  return url?.replace(/\/+$/, "");
}

export function getAppUrl() {
  const url = resolveAppUrl();
  if (!url) throw new Error("APP_URL is not set");
  return url;
}

// Hosts Better Auth accepts requests from on Vercel: this deployment's own
// URLs plus the configured origins, never every `*.vercel.app`. Null off
// Vercel, where the single BETTER_AUTH_URL applies.
export function vercelAuthHosts(env: Env = process.env) {
  if (!env.VERCEL) return null;
  const hosts = [
    env.BETTER_AUTH_URL && new URL(env.BETTER_AUTH_URL).host,
    env.APP_URL && new URL(env.APP_URL).host,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_URL,
  ].filter((host): host is string => Boolean(host));
  return [...new Set(hosts)];
}
