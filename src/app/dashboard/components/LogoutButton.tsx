"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/dashboard/logout", { method: "POST" });
    router.push("/dashboard/login");
  }

  return (
    <button onClick={handleLogout} className="db-logout-btn">
      Logga ut
    </button>
  );
}
