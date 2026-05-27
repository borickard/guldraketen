import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json([]);

  const escaped = q.replace(/[%_,]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name, avatar_url, category")
    .eq("is_active", true)
    .or(`handle.ilike.${pattern},display_name.ilike.${pattern}`)
    .order("followers", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
