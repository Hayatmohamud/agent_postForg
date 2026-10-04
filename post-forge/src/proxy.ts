/**
 * Route protection for the authenticated app shell. Next.js 16 renamed
 * `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()` (confirmed against
 * this project's own bundled docs, `node_modules/next/dist/docs/.../
 * proxy.md`) — this is NOT the old `middleware` API.
 *
 * Wraps `auth()` (Auth.js v5's proxy-compatible helper) to redirect signed-
 * out requests for any `(app)` route to `/sign-in`, preserving the original
 * path via `callbackUrl` so Auth.js returns the user to where they started
 * after OAuth completes.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/new-post/:path*", "/library/:path*", "/scheduled/:path*", "/settings/:path*", "/posts/:path*"],
};
