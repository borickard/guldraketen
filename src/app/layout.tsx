import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import FeedbackButton from "./components/FeedbackButton";
import { Analytics } from "@vercel/analytics/next";

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
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@100;400;500;700&family=Barlow+Condensed:wght@400;700&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBar />
        {children}
        <FeedbackButton />
        <Analytics />
      </body>
    </html>
  );
}