import { NextResponse } from "next/server";
import {
  fetchDriveGalleryImages,
  resolveGalleryPhotoForPage,
} from "@/lib/drive-gallery-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  try {
    const images = await fetchDriveGalleryImages();
    const image = await resolveGalleryPhotoForPage(rawId, images);
    if (!image) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "drive_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
