import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--f-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });

const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: "Tech Cogniverse · AI systems, live in 45 days",
  description: "Tech Cogniverse builds AI agents, voice systems, and custom software that run real operations. Fixed price, a demo every Friday. Chennai, India.",
  openGraph: { type: "website", siteName: "Tech Cogniverse", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#f4f2ee", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* The film only runs when script can; without it every chapter shows as a still. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.js=''" }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
