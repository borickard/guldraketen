import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: "Sociala raketer",
  description: "Sveriges mest engagerande TikTok-konton — rankade varje vecka",
  openGraph: {
    title: "Sociala raketer",
    description: "Sveriges mest engagerande TikTok-konton — rankade varje vecka",
    url: "https://guldraketen.vercel.app",
    siteName: "Sociala raketer",
    locale: "sv_SE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}