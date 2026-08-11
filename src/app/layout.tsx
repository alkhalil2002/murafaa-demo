import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { t } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: t("app.name"),
    // "default" keeps the iOS status bar legible against the parchment
    // background; "black-translucent" would put dark text under the notch.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    // iOS otherwise turns every case number and Hijri date into a phone link.
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0e3a30",
  width: "device-width",
  initialScale: 1,
  // viewportFit=cover + the safe-area insets in globals.css keep the bottom bar
  // clear of the iOS home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} ${amiri.variable}`}>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
