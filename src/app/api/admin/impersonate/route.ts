import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/adminAuth";
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/dashboardAuth";

// Admin-only — issue a dashboard session for an existing user so the admin
// can browse the dashboard as them. Requires a valid admin cookie. The admin's
// own admin_session cookie stays intact, which the dashboard page reads to
// render the "viewing as" banner.

export async function POST(req: NextRequest) {
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = adminToken ? await verifyAdminSession(adminToken) : false;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId krävs" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: handleRows } = await supabaseAdmin
    .from("user_handles")
    .select("handle")
    .eq("user_id", user.id);
  const handles = (handleRows ?? []).map((r) => r.handle);

  const token = await signSession({
    userId: user.id,
    username: user.username,
    handles,
    impersonated: true,
  });
  const res = NextResponse.json({ ok: true, username: user.username, handles });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
