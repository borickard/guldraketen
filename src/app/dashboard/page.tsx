import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/dashboardAuth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) redirect("/dashboard/login");

  // Will be replaced with the full dashboard UI in the next step
  return (
    <div style={{ padding: "4rem 2rem", fontFamily: "Barlow, sans-serif", background: "#EBE7E2", minHeight: "100vh" }}>
      <p style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem" }}>
        Inloggad som {session.username}
      </p>
      <h1 style={{ fontSize: "2rem", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700 }}>
        Dashboard
      </h1>
      <p style={{ marginTop: "1rem", color: "#555", fontSize: 14 }}>
        Konton: {session.handles.join(", ") || "inga tilldelade ännu"}
      </p>
    </div>
  );
}
