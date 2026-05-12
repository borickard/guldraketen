import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/dashboardAuth";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Användarnamn och lösenord krävs" }, { status: 400 });
  }

  // Fetch user
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, username, password_hash, is_active, login_count")
    .eq("username", username.trim().toLowerCase())
    .single();

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: "Fel användarnamn eller lösenord" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Fel användarnamn eller lösenord" }, { status: 401 });
  }

  // Track login activity — best-effort, don't block on failure.
  // login_count has a NOT NULL DEFAULT 0 in the schema so the read is safe.
  void supabaseAdmin
    .from("users")
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count ?? 0) + 1,
    })
    .eq("id", user.id)
    .then(() => null);

  // Fetch associated handles
  const { data: handleRows } = await supabaseAdmin
    .from("user_handles")
    .select("handle")
    .eq("user_id", user.id);

  const handles = (handleRows ?? []).map((r) => r.handle);

  const token = await signSession({ userId: user.id, username: user.username, handles });

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
