import type { Metadata, Viewport } from "next";
import { Cairo, Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeController } from "@/components/ThemeController";

// Blocking no-FOUC script: applies the sun-cycle theme class before first paint.
// Auto = Light 06:00–18:00 local, Dark otherwise; honours a saved override.
const THEME_INIT = `(function(){try{
  var k='agro-theme', v=localStorage.getItem(k);
  var h=new Date().getHours();
  var t=(v==='light'||v==='dark')?v:((h>=6&&h<18)?'light':'dark');
  var c=document.documentElement.classList; c.remove('light','dark'); c.add(t);
}catch(e){}})();`;

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// IBM Plex Sans Arabic — superior glyph coverage for dense Arabic UI labels
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-ibm-arabic",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "أغرو-سيريا | Agro-Syria",
  description: "منصة الزراعة الذكية للمزارع السوري — أسعار المحاصيل، الطقس، والمساعد الزراعي",
  applicationName: "أغرو-سيريا",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "أغرو-سيريا",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#284",
    "msapplication-TileImage": "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#284",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${inter.variable} ${ibmPlexArabic.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
