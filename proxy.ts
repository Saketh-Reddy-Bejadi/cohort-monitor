import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: is there a session cookie? Real authorization
// happens in lib/session.ts and lib/api-auth.ts. The redirect uses AUTH_URL when
// set, because request.url can carry an internal host behind a proxy.
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/signin", process.env.AUTH_URL ?? request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api(?:/|$)|signin(?:/|$)|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
