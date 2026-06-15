import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sociala Raketer | Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
