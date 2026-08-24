import type { Metadata, Viewport } from "next";
import { DM_Sans, Libre_Baskerville } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const libre = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000/";
const metadataBase = new URL(siteUrl);
const socialImage = new URL(`${basePath}/og.png`, metadataBase.origin).toString();

export const metadata: Metadata = {
    metadataBase,
    title: "Srilatha's X Word — Made just for you",
    description: "Srilatha's personal crossword app, made with love.",
    manifest: `${basePath}/manifest.webmanifest`,
    applicationName: "Srilatha's X Word",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Srilatha's X Word",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "Srilatha's X Word",
      description: "A crossword, made just for you.",
      type: "website",
      url: siteUrl,
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Srilatha's X Word crossword app" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Srilatha's X Word",
      description: "A crossword, made just for you.",
      images: [socialImage],
    },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f2e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${libre.variable}`}>{children}</body>
    </html>
  );
}
