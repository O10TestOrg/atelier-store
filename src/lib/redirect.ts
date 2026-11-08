// Placeholder origin for parsing: only the path that comes back is used.
const BASE = "https://atelier.invalid";

// Only same-origin paths, so `?next=` can't send users off-site. Parsed the
// way the browser will parse it, since URL parsing strips tabs and newlines
// and turns `\` into `/` (`/\t/evil.com` becomes `//evil.com`).
export function safeRedirectPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Belt and braces: the result must itself stay a single-slash path.
  return path.startsWith("//") || path.startsWith("/\\") ? fallback : path;
}
