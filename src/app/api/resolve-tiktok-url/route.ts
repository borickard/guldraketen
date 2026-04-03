import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { url } = body ?? {};

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url krävs" }, { status: 400 });
  }

  let finalUrl: string;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });
    finalUrl = res.url;
  } catch (err) {
    return NextResponse.json(
      { error: `Kunde inte hämta länken: ${err}` },
      { status: 502 }
    );
  }

  const videoId = finalUrl.match(/\/video\/(\d+)/)?.[1] ?? null;
  const handle = finalUrl.match(/\/@([^/?#\s]+)/)?.[1] ?? null;

  if (!videoId) {
    return NextResponse.json(
      { error: "Länken leder inte till en TikTok-video. Kontrollera att du kopierade rätt länk." },
      { status: 422 }
    );
  }

  return NextResponse.json({ videoId, handle });
}
