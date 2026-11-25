import { NextResponse } from "next/server";
import { findStarPlayer } from "@/lib/star-players";
import { fetchStarPlayerPhotos } from "@/lib/star-photos";

// force-dynamic 을 쓰지 않는다: 그러면 하위 드라이브 fetch(revalidate: 3600)의 캐시가
// 무시되어 매 진입마다 voto + 홈 갤러리 전체를 다시 긁어 느려진다.
// 이 route 는 ?player= 쿼리 때문에 동적으로 처리되지만, 드라이브 fetch 는
// 각자의 1시간 캐시를 재사용하므로 두 번째 진입부터 즉시 응답한다.
export const revalidate = 3600;

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
