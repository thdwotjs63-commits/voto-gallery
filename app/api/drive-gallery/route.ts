import { NextResponse } from "next/server";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

export const revalidate = 300;

export async function GET() {
  try {
    const selfieFolderId = process.env.NEXT_PUBLIC_SELFIE_FOLDER_ID?.trim();
    const images = await fetchDriveGalleryImages(undefined, {
      excludeFolderIds: selfieFolderId ? [selfieFolderId] : [],
    });
    return NextResponse.json(images);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
