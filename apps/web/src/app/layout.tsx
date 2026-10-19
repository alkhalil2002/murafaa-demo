import type { Metadata } from "next";
import { defaultLocale, dirOf, t } from "@murafaa/i18n";
import "./globals.css";

// Fonts are self-hosted (public/fonts, styles/tokens/fonts.css): no request leaves the Kingdom.

export const metadata: Metadata = {
  title: t("app.name"),
  description: t("app.tagline"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} dir={dirOf(defaultLocale)}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
