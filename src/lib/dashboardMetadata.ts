import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession, COOKIE_NAME } from "./dashboardAuth";

function titleCase(s: string): string {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

export async function dashboardMetadata(suffix?: string): Promise<Metadata> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  const base = session ? `${titleCase(session.username)} Dashboard` : "Dashboard";
  return {
    title: `Sociala Raketer | ${suffix ? `${base} · ${suffix}` : base}`,
  };
}
