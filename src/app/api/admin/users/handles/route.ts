import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { user_id, handle } = await req.json();
  if (!user_id || !handle) return NextResponse.json({ error: "user_id och handle krävs" }, { status: 400 });

  const { error } = await supabaseAdmin.from("user_handles").insert({ user_id, handle });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { user_id, handle } = await req.json();

  const { error } = await supabaseAdmin
    .from("user_handles")
    .delete()
    .eq("user_id", user_id)
    .eq("handle", handle);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
