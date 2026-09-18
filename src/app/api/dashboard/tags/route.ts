import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

// Per-user content tags. All routes scope to the logged-in dashboard user.

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("content_tags")
    .select("id, name, type, color")
    .eq("user_id", session.userId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
  if (!name || !type) {
    return NextResponse.json({ error: "name och type krävs" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("content_tags")
    .insert({ user_id: session.userId, name, type, color })
    .select("id, name, type, color")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "En tagg med det namnet finns redan i den typen." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const update: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.type === "string" && body.type.trim()) update.type = body.type.trim();
  if (typeof body.color === "string") update.color = body.color.trim();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("content_tags")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", session.userId)
    .select("id, name, type, color")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "En tagg med det namnet finns redan i den typen." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  // Mappings cascade-delete via the FK.
  const { error } = await supabaseAdmin
    .from("content_tags")
    .delete()
    .eq("id", body.id)
    .eq("user_id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
