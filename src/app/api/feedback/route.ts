import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

// Required table (run once in Supabase SQL editor):
// create table feedback (
//   id uuid primary key default gen_random_uuid(),
//   email text,
//   message text not null,
//   created_at timestamptz default now()
// );

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, message, page } = body ?? {};

  if (!message?.trim())
    return NextResponse.json({ error: "message krävs" }, { status: 400 });

  const { error } = await supabaseAdmin.from("feedback").insert({
    email: email?.trim() || null,
    message: String(message).trim(),
    page: page ? String(page).slice(0, 500) : null,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
