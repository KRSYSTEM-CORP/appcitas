import { NextResponse, type NextRequest } from "next/server";

// Inert until ROOT_DOMAIN is set (see .env.example) — until then every
// request passes through untouched and businesses are reached at
// /book/[subdomain] (see app/book/[subdomain]/page.tsx), which works
// identically on any domain, including the default *.vercel.app one.
//
// Once ROOT_DOMAIN is set to a real domain you own (e.g. "kyracitas.app")
// and its DNS points a wildcard subdomain at this deployment, a visit to
// bella-vista.kyracitas.app is rewritten internally to /book/bella-vista —
// the URL bar still shows the subdomain, nothing else on the site is
// reachable from it.
const ROOT_DOMAIN = process.env.ROOT_DOMAIN;

export function proxy(request: NextRequest) {
  if (!ROOT_DOMAIN) return NextResponse.next();

  const hostname = (request.headers.get("host") ?? "").split(":")[0];
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.next();
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    if (subdomain && subdomain !== "www") {
      const url = request.nextUrl.clone();
      url.pathname = `/book/${subdomain}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
