import { NextResponse } from "next/server";
import { findStarPlayer } from "@/lib/star-players";
import { fetchStarPlayerPhotos } from "@/lib/star-photos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("player") ?? "").trim();
  const player = findStarPlayer(slug);

  if (!player) {
    return NextResponse.json({ error: "선수를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const images = await fetchStarPlayerPhotos(player);
    return NextResponse.json(images);
  } catch (error) {
    const message = error instanceof Error ? error.message : "사진을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
