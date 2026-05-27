import { NextResponse } from "next/server";
import { signAdminSession, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const { password } = await req.json();
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 500 });
  }

  if (password === correct) {
    const token = await signAdminSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
