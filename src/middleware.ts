import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateConfig, gateToken, safeEqual } from "./lib/auth/access-gate";

// Paths that work without the gate: the sign-in screen itself, static
// assets, and machine endpoints that carry their own auth.
const OPEN = [/^\/access(\/|$)/, /^\/api\/cron\//, /^\/api\/webhooks\//, /^\/manifest\.webmanifest$/, /^\/icon\.svg$/, /^\/sw\.js$/];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();

  const cfg = gateConfig();
  if (!cfg) {
    // Local dev runs open. A deployed site never runs open by accident.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Access is not configured. Set ACCESS_EMAIL and ACCESS_PASSWORD in the Vercel project.", { status: 503 });
  }

  const cookie = req.cookies.get(GATE_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await gateToken(cfg))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Signed out. Sign in again." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/access";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
