import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

const publicUrl = "https://kevinlabens-del.github.io/CR3-TIX-ADVENTURE-/";
const socialImageUrl = `${publicUrl}icons/icon-512.png`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#02030b",
};

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  applicationName: "CR3@TIX ADVENTURE",
  title: "CR3@TIX ADVENTURE",
  description: "Une aventure de plateforme et de combat en 110 niveaux, avec progression, missions variées et 10 boss uniques.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CR3@TIX" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "CR3@TIX ADVENTURE",
    description: "Explore 110 niveaux, améliore ton héros et affronte 10 boss uniques en trois phases.",
    type: "website",
    url: publicUrl,
    images: [{ url: socialImageUrl, alt: "CR3@TIX ADVENTURE — Explore NEXUS-7" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CR3@TIX ADVENTURE",
    description: "Explore 110 niveaux, améliore ton héros et affronte 10 boss uniques en trois phases.",
    images: [socialImageUrl],
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
  other: { "mobile-web-app-capable": "yes", "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Script
          src="https://kevinlabens-del.github.io/CR3-TIX-ANALYTIX./analytics.js"
          data-project-id="37f3a1ee-841a-44f8-9009-34618c5b582c"
          data-project-key="56885829-c2e1-496c-a739-e8ab63f6c1cf"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
