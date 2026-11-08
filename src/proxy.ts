import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";

// Optimistic check only: it sees whether a session cookie exists, not whether
// it's valid. Pages verify with `requireUser()` / `requireAdmin()` from
// `@/lib/session`.
//
// The header's account link adds `?from=<page>` (`AccountLink`), so a shopper
// who signs in from a product or the bag goes back there afterwards.
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const from = pathname === "/account" ? searchParams.get("from") : null;

  if (getSessionCookie(request)) {
    return from === null
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/account", request.url));
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", from === null ? pathname + search : safeRedirectPath(from));
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
