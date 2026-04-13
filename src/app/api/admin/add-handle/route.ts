import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { startScrapeForHandles } from "@/lib/scrape";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId, handle: rawHandle, postsBack = 50 } = await req.json();

  if (!userId || !rawHandle)
    return NextResponse.json({ error: "userId och handle krävs" }, { status: 400 });

  const handle = String(rawHandle).trim().replace(/^@/, "").toLowerCase();
  if (!handle)
    return NextResponse.json({ error: "Ogiltigt handle" }, { status: 400 });

  // 1. Upsert the account — create it if it doesn't exist, or leave existing data intact
  const { error: accountErr } = await supabaseAdmin
    .from("accounts")
    .upsert({ handle, is_active: true }, { onConflict: "handle" });
  if (accountErr)
    return NextResponse.json({ error: `Kunde inte skapa konto: ${accountErr.message}` }, { status: 500 });

  // 2. Link handle to user (ignore if already linked)
  const { error: linkErr } = await supabaseAdmin
    .from("user_handles")
    .upsert({ user_id: userId, handle }, { onConflict: "user_id,handle", ignoreDuplicates: true });
  if (linkErr)
    return NextResponse.json({ error: `Kunde inte koppla konto: ${linkErr.message}` }, { status: 500 });

  // 3. Trigger a targeted scrape for this handle only
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const webhookUrl = `${baseUrl}/api/scrape/webhook`;
    const result = await startScrapeForHandles([handle], webhookUrl, postsBack);
    return NextResponse.json({ ok: true, runId: result.runId, scrapeRunId: result.scrapeRunId });
  } catch (err) {
    // Account + link succeeded — return partial success with scrape error noted
    return NextResponse.json({
      ok: true,
      scrapeError: err instanceof Error ? err.message : String(err),
    });
  }
}
