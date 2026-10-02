import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";
import { buildRootMetadata, SITE_URL } from "@/lib/seo-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = buildRootMetadata({
  imageUrl: `${SITE_URL.replace(/\/$/, "")}/hero.jpg`,
  imageWidth: 1200,
  imageHeight: 630,
  imageAlt: "배구선수 김다인",
});

export const viewport: Viewport = {
  themeColor: "#1e3e96",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-black">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
