import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nominera ett konto — Sociala raketer",
  description: "Känner du ett svenskt företag som skapar engagerande innehåll på TikTok? Nominera dem till Sociala raketer.",
  openGraph: {
    title: "Nominera ett konto till Sociala raketer",
    description: "Vi rankar Sveriges mest engagerande TikTok-konton varje vecka. Känner du ett konto som borde vara med?",
    url: "https://guldraketen.vercel.app/nominera",
    siteName: "Sociala raketer",
    locale: "sv_SE",
    type: "website",
  },
};

export default function NomineraLayout({ children }: { children: React.ReactNode }) {
  return children;
}
