import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#02030b",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://cr3atix-adventure.fallback-bzh.chatgpt.site"),
  applicationName: "CR3@TIX ADVENTURE",
  title: "CR3@TIX ADVENTURE",
  description: "Une aventure de plateforme et de combat en 110 niveaux, avec progression, missions variées et 10 boss uniques.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CR3@TIX",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "CR3@TIX ADVENTURE",
    description: "Explore 110 niveaux, améliore ton héros et affronte 10 boss uniques en trois phases.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CR3@TIX ADVENTURE — Explore NEXUS-7" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CR3@TIX ADVENTURE",
    description: "Explore 110 niveaux, améliore ton héros et affronte 10 boss uniques en trois phases.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
