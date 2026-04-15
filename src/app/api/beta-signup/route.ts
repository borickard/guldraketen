/**
 * Beta waitlist signup.
 *
 * Requires a `beta_signups` table in Supabase:
 *
 *   CREATE TABLE beta_signups (
 *     id         uuid primary key default gen_random_uuid(),
 *     email      text not null,
 *     handle     text,
 *     video_url  text,
 *     created_at timestamptz default now()
 *   );
 *   CREATE UNIQUE INDEX beta_signups_email_idx ON beta_signups(lower(email));
 *
 *  If upgrading an existing table, add the handle column:
 *   ALTER TABLE beta_signups ADD COLUMN IF NOT EXISTS handle text;
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, videoUrl, handle } = body ?? {};

  if (!email || typeof email !== "string" || !/\S+@\S+\.\S+/.test(email.trim())) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("beta_signups").insert({
    email: email.trim().toLowerCase(),
    handle: handle ? String(handle).trim().replace(/^@/, "") : null,
    video_url: videoUrl ?? null,
  });

  if (error) {
    // 23505 = unique constraint violation — email already registered, treat as success
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("beta_signups insert error", error);
    return NextResponse.json({ error: "Kunde inte spara. Prova igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
