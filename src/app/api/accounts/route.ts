import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

// GET – hämta alla konton
export async function GET() {
    const { data, error } = await supabaseAdmin
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// POST – lägg till nytt konto
export async function POST(req: Request) {
    const { handle } = await req.json();
    const clean = handle?.trim().replace(/^@/, "").toLowerCase();

    if (!clean) {
        return NextResponse.json({ error: "Handle saknas" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from("accounts")
        .insert({ handle: clean })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            return NextResponse.json({ error: "Kontot finns redan" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

// PATCH – uppdatera is_active
export async function PATCH(req: Request) {
    const { id, is_active } = await req.json();

    const { data, error } = await supabaseAdmin
        .from("accounts")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

// DELETE – ta bort konto
export async function DELETE(req: Request) {
    const { id } = await req.json();

    const { error } = await supabaseAdmin
        .from("accounts")
        .delete()
        .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}