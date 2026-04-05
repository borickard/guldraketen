import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
  }

  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  return NextResponse.json({ ok: true, expiry });
}
