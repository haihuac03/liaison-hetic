import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/auth", "/connexion", "/inscription", "/invitation"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get("liaison_session")?.value) {
    const origin = process.env.APP_ORIGIN || `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
    const target = new URL("/auth", origin);
    target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.svg|images|.*\\.[^/]+$).*)"],
};
