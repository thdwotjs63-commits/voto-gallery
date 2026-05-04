import { NextResponse } from "next/server";
import { DEFAULT_VOTO_CATEGORY, isVotoCategoryId } from "@/lib/voto-categories";
import { fetchVotoCategoryImages } from "@/lib/voto-gallery-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("category") ?? DEFAULT_VOTO_CATEGORY).trim().toLowerCase();
  const category = isVotoCategoryId(raw) ? raw : DEFAULT_VOTO_CATEGORY;

  try {
    const images = await fetchVotoCategoryImages(category);
    return NextResponse.json(images);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Voto gallery.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
