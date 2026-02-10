import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHandle, isPlausibleHandle, isEmail } from "@/lib/validation";

type Platform = "tiktok" | "instagram" ;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const platform = String(body.platform || "").toLowerCase() as Platform;
    const rawHandle = String(body.handle || "");
    const email = String(body.email || "").trim().toLowerCase();

    if (!["tiktok", "instagram"].includes(platform)) {
      return NextResponse.json({ ok: false, error: "Ogiltig plattform." }, { status: 400 });
    }

    const handle = normalizeHandle(rawHandle);
    if (!handle || !isPlausibleHandle(handle)) {
      return NextResponse.json({ ok: false, error: "Ogiltigt användarnamn." }, { status: 400 });
    }

    if (!email || !isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Ange en giltig e-postadress." }, { status: 400 });
    }

    // En snabb env-check så vi får tydligt fel om det är där det brister
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Servern saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const { error } = await supabaseAdmin.from("nominations").insert({
      platform,
      handle,
      email,
      legal_basis: "legitimate_interest",
    });

    if (error) {
      // Unik constraint (plattform+handle)
      if (String(error.code) === "23505") {
        return NextResponse.json({ ok: true, message: "Tack! Kontot är redan nominerat." }, { status: 200 });
      }
      return NextResponse.json({ ok: false, error: `Supabase: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Serverfel: ${e?.message || "okänt fel"}` },
      { status: 500 }
    );
  }
}