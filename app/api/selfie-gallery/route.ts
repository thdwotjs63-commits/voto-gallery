import { NextResponse } from "next/server";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

export const revalidate = 300;

export async function GET() {
  try {
    const folderId = process.env.NEXT_PUBLIC_SELFIE_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({ error: "SELFIE_FOLDER_ID not set" }, { status: 500 });
    }

    const images = await fetchDriveGalleryImages(folderId);
    return NextResponse.json(images);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
