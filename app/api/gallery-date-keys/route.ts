import { NextResponse } from "next/server";
import { buildGalleryDateKeySet } from "@/lib/gallery-date-link";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

export const revalidate = 300;

export async function GET() {
  try {
    const selfieFolderId = process.env.NEXT_PUBLIC_SELFIE_FOLDER_ID?.trim();
    const images = await fetchDriveGalleryImages(undefined, {
      excludeFolderIds: selfieFolderId ? [selfieFolderId] : [],
    });
    const dateKeys = [...buildGalleryDateKeySet(images)].sort((a, b) => b - a);
    return NextResponse.json({ dateKeys });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load gallery dates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
