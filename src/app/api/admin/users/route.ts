import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, username, is_active, created_at, notes")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: handles } = await supabaseAdmin
    .from("user_handles")
    .select("user_id, handle");

  const result = (users ?? []).map((u) => ({
    ...u,
    handles: (handles ?? []).filter((h) => h.user_id === u.id).map((h) => h.handle),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: "Användarnamn och lösenord krävs" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({ username: username.trim().toLowerCase(), password_hash })
    .select("id, username, is_active, created_at, notes")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Användarnamnet finns redan" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, handles: [] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { id, is_active, password, notes } = await req.json();

  const updates: Record<string, unknown> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  if (notes !== undefined) updates.notes = notes || null;
  if (password) updates.password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  const { error } = await supabaseAdmin.from("users").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
