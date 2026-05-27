import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (typeof current_password !== "string" || typeof new_password !== "string") {
    return NextResponse.json({ error: "Lösenord saknas" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: "Nytt lösenord måste vara minst 8 tecken" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", session.userId)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return NextResponse.json({ error: "Fel nuvarande lösenord" }, { status: 401 });

  const newHash = await bcrypt.hash(new_password, 10);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_hash: newHash })
    .eq("id", session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
