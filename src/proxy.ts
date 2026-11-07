import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: it sees whether a session cookie exists, not whether
// it's valid. Pages verify with `requireUser()` / `requireAdmin()` from
// `@/lib/session`.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname + search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
