import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";
import { buildRootMetadata } from "@/lib/seo-metadata";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const images = await fetchDriveGalleryImages();
    const heroImage = images.find((image) => image.tags.includes("#hero"));
    if (!heroImage) {
      return buildRootMetadata();
    }

    return buildRootMetadata({
      imageUrl: heroImage.originalUrl,
      imageWidth: heroImage.width,
      imageHeight: heroImage.height,
      imageAlt: heroImage.name || "voto gallery",
    });
  } catch {
    return buildRootMetadata();
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-black">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
