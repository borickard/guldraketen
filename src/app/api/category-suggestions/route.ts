import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHandle, isPlausibleHandle, isEmail } from "@/lib/validation";
import { CATEGORIES } from "@/lib/categories";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawHandle = String(body.handle || "");
    const displayName = String(body.display_name || "").trim();
    const category = String(body.category || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const motivation = String(body.motivation || "").trim();

    const handle = normalizeHandle(rawHandle);
    if (!handle || !isPlausibleHandle(handle)) {
      return NextResponse.json({ ok: false, error: "Ogiltigt användarnamn." }, { status: 400 });
    }
    if (displayName.length < 2 || displayName.length > 80) {
      return NextResponse.json({ ok: false, error: "Ange ett namn på företaget/organisationen." }, { status: 400 });
    }
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ ok: false, error: "Okänd kategori." }, { status: 400 });
    }
    if (email && !isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Ange en giltig e-postadress." }, { status: 400 });
    }
    if (motivation.length > 1000) {
      return NextResponse.json({ ok: false, error: "Motivering är för lång." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("category_suggestions").insert({
      handle,
      display_name: displayName,
      suggested_category: category,
      email: email || null,
      motivation: motivation || null,
    });

    if (error) {
      if (String(error.code) === "23505") {
        return NextResponse.json(
          { ok: true, message: "Tack! Kontot är redan föreslaget för denna kategori." },
          { status: 200 }
        );
      }
      return NextResponse.json({ ok: false, error: `Supabase: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "okänt fel";
    return NextResponse.json({ ok: false, error: `Serverfel: ${message}` }, { status: 500 });
  }
}
