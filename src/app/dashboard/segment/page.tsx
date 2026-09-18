import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";
import { dashboardMetadata } from "@/lib/dashboardMetadata";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardHeader from "../components/DashboardHeader";
import SegmentClient from "./SegmentClient";

export const generateMetadata = () => dashboardMetadata("Segment");

interface HandleOpt {
  handle: string;
  display_name: string | null;
}

async function fetchHandles(handles: string[]): Promise<HandleOpt[]> {
  if (handles.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("accounts")
    .select("handle, display_name")
    .in("handle", handles);
  return data ?? [];
}

export default async function SegmentPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/dashboard/login");

  const isImpersonating = session.impersonated === true;
  const handles = await fetchHandles(session.handles);

  return (
    <>
      <style>{styles}</style>
      <div className="db-root">
        <DashboardHeader
          impersonating={isImpersonating ? { username: session.username } : null}
        />
        <main className="db-main">
          {handles.length === 0 ? (
            <p className="db-empty">Inga konton är tilldelade din profil ännu. Kontakta administratören.</p>
          ) : (
            <SegmentClient handles={handles} />
          )}
        </main>
      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .db-root {
    min-height: 100vh;
    background: #EBE7E2;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }

  .db-main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }

  .db-empty {
    font-size: 14px;
    color: #888;
    padding: 3rem 0;
  }
`;
