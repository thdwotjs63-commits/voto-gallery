import { NextResponse } from "next/server";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

export const revalidate = 300;

export async function GET() {
  try {
    const images = await fetchDriveGalleryImages();
    return NextResponse.json(images);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
