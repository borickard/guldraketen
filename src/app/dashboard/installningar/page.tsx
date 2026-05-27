import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";
import DashboardHeader from "../components/DashboardHeader";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/dashboard/login");

  const isImpersonating = session.impersonated === true;

  return (
    <>
      <style>{styles}</style>
      <div className="dst-root">
        <DashboardHeader
          impersonating={isImpersonating ? { username: session.username } : null}
        />
        <main className="dst-main">
          <h1 className="dst-title">Inställningar</h1>
          <SettingsClient username={session.username} />
        </main>
      </div>
    </>
  );
}

const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .dst-root {
    min-height: 100vh;
    background: #EBE7E2;
    font-family: 'Barlow', sans-serif;
    color: #1C1B19;
  }

  .dst-main {
    max-width: 640px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 6rem;
  }

  .dst-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 2rem;
  }
`;
