import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Skip API routes, admin, static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // If already on a /review/ or /intake/ route, let it through
  if (pathname.startsWith("/review/") || pathname.startsWith("/intake/")) {
    return NextResponse.next();
  }

  // Custom domain handling:
  // If the hostname is NOT our main domain, it's a custom domain.
  // Rewrite the root "/" to "/review/lookup?domain=hostname"
  // The review page will look up the client by custom_domain.
  const isMainDomain =
    hostname.startsWith("localhost") ||
    hostname === "reviews.quicklaunchweb.us" ||
    hostname.endsWith(".vercel.app");

  if (!isMainDomain && pathname === "/") {
    // Rewrite to a special route that looks up by custom domain
    const url = request.nextUrl.clone();
    url.pathname = "/review/lookup";
    url.searchParams.set("domain", hostname);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
