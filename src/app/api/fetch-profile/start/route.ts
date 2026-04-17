import { NextRequest, NextResponse } from "next/server";

const APIFY_ACTOR_ID = "clockworks~tiktok-profile-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { handle } = body ?? {};

  if (!handle) {
    return NextResponse.json({ error: "handle krävs" }, { status: 400 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_TOKEN saknas" }, { status: 500 });
  }

  let apifyRes: Response;
  try {
    apifyRes = await fetch(
      `${APIFY_API_BASE}/acts/${encodeURIComponent(APIFY_ACTOR_ID)}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({
          profiles: [`@${handle}`],
          profileScrapeSections: ["videos"],
          profileSorting: "latest",
          resultsPerPage: 10,
        }),
      }
    );
  } catch (err) {
    return NextResponse.json({ error: `Nätverksfel mot Apify: ${err}` }, { status: 502 });
  }

  if (!apifyRes.ok) {
    const text = await apifyRes.text();
    return NextResponse.json({ error: `Apify error ${apifyRes.status}: ${text}` }, { status: 502 });
  }

  const json = await apifyRes.json();
  const runId: string = json?.data?.id;

  if (!runId) {
    return NextResponse.json({ error: "Inget runId från Apify" }, { status: 502 });
  }

  return NextResponse.json({ runId });
}
