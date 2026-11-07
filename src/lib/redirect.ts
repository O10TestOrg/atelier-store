// Only same-origin relative paths, so `?next=` can't send users off-site.
export function safeRedirectPath(value: unknown, fallback = "/account") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
