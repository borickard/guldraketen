/**
 * Beta waitlist signup.
 *
 * Requires a `beta_signups` table in Supabase:
 *
 *   CREATE TABLE beta_signups (
 *     id         uuid primary key default gen_random_uuid(),
 *     email      text not null,
 *     video_url  text,
 *     created_at timestamptz default now()
 *   );
 *   CREATE UNIQUE INDEX beta_signups_email_idx ON beta_signups(lower(email));
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, videoUrl } = body ?? {};

  if (!email || typeof email !== "string" || !/\S+@\S+\.\S+/.test(email.trim())) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("beta_signups").upsert(
    { email: email.trim().toLowerCase(), video_url: videoUrl ?? null },
    { onConflict: "email", ignoreDuplicates: true }
  );

  if (error) {
    console.error("beta_signups insert error", error);
    return NextResponse.json({ error: "Kunde inte spara. Prova igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
