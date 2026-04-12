import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /dashboard routes (except /dashboard/login)
  if (pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/login")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? await verifySession(token) : null;

    if (!session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/dashboard/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
