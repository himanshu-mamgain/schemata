import type { Metadata, Viewport } from "next";
import { Caveat, Inter, JetBrains_Mono } from "next/font/google";
import { Shell } from "../components/Shell";
import { themeBootScript } from "../theme-boot";
import { installBootScript } from "../pwa/install";
import { accountBootScript } from "../account/config";
import "../styles.css";

// Inter for reading (as in Structura), JetBrains Mono for code, Caveat for margin notes and hints.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://schemata-web.netlify.app"),
  title: { default: "Schemata: learn databases", template: "%s · Schemata" },
  description:
    "Learn databases: a real PostgreSQL SQL editor in your browser, ER diagrams from DBML, schema design problems, interview questions from basic to advanced, a roadmap, and when to use each database.",
  applicationName: "Schemata",
  appleWebApp: { capable: true, title: "Schemata", statusBarStyle: "default" },
  icons: { icon: "/favicon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: { type: "website", siteName: "Schemata" },
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="paper" className={`${sans.variable} ${mono.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        {/* First, so a signed-out visitor goes to Studia's login before the page paints (when sign-in is required). */}
        {accountBootScript && <script dangerouslySetInnerHTML={{ __html: accountBootScript }} />}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript + installBootScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
