import { fetchVotoCategoryImages, type VotoImage } from "@/lib/voto-gallery-data";
import { fetchDriveGalleryImages, type DriveImage } from "@/lib/drive-gallery-data";
import { ALL_VOTO_CATEGORY } from "@/lib/voto-categories";
import { filterImagesByQuery } from "@/lib/voto-search-index";
import type { StarPlayer } from "@/lib/star-players";

/** 검색/매칭용 정규화 — 파일명 NFD/NFC 차이 흡수 + 소문자화. */
function normalize(input: string): string {
  return input.normalize("NFC").toLowerCase().trim();
}

/**
 * 홈 갤러리의 scheduleDateKey(YYYYMMDD 정수)를 epoch ms 로 변환한다.
 * voto 사진의 sortTimeMs(실제 ms)와 같은 축으로 섞어 정렬하기 위함.
 * 날짜를 못 읽으면 0 (맨 뒤로).
 */
function scheduleDateKeyToMs(dateKey: number): number {
  if (!Number.isFinite(dateKey) || dateKey < 10000101) return 0;
  const y = Math.floor(dateKey / 10000);
  const m = Math.floor((dateKey % 10000) / 100);
  const d = dateKey % 100;
  if (m < 1 || m > 12 || d < 1 || d > 31) return 0;
  const ms = Date.UTC(y, m - 1, d);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 다인 홈 갤러리의 "함께 찍은" 사진(DriveImage)을 voto 갤러리와 같은 VotoImage 형태로 변환.
 * 선수 사진 페이지의 그리드/라이트박스가 읽는 필드만 채운다:
 * id, thumbSrc, fullSrc, downloadUrl, width, height, infoTitle, smartTags, sortTimeMs, name 등.
 */
function driveImageToVotoImage(img: DriveImage): VotoImage {
  const withLabel = img.withTags.length > 0 ? `함께 · ${img.withTags.join(", ")}` : "다인 홈 갤러리";
  return {
    // 다른 소스와 id 가 겹치지 않게 접두사
    id: `home-${img.id}`,
    categoryId: "women_volleyball",
    name: img.name,
    baseName: img.name,
    description: img.description ?? "",
    thumbSrc: img.thumbnailUrl,
    fullSrc: img.originalUrl,
    downloadUrl: img.downloadUrl,
    width: img.width,
    height: img.height,
    capturedAtMs: null,
    fileNameDateMs: null,
    fileNameDateToken: null,
    createdAtMs: null,
    sortTimeMs: scheduleDateKeyToMs(img.scheduleDateKey),
    infoTitle: withLabel,
    smartTags: img.withTags,
  };
}

/** withTags 안에 이 선수가 들어있는지 — 선수명과 galleryQuery 둘 다로 매칭. */
function withTagsMatchPlayer(withTags: string[], player: StarPlayer): boolean {
  if (withTags.length === 0) return false;
  const needles = new Set<string>();
  needles.add(normalize(player.name));
  if (player.galleryQuery) needles.add(normalize(player.galleryQuery));
  return withTags.some((tag) => {
    const t = normalize(tag);
    for (const n of needles) {
      if (!n) continue;
      if (t === n || t.includes(n) || n.includes(t)) return true;
    }
    return false;
  });
}

/**
 * 선수 사진 페이지용 병합 결과.
 * 1) voto 갤러리(전체)에서 galleryQuery 로 검색한 사진
 * 2) 다인 홈 갤러리에서 withTags 에 이 선수가 포함된 "함께 찍은" 사진
 * 을 하나로 섞어 날짜순(최신 우선)으로 돌려준다.
 * 중복 id 는 제거. 실패한 소스가 있어도 나머지는 살린다.
 */
export async function fetchStarPlayerPhotos(player: StarPlayer): Promise<VotoImage[]> {
  const query = player.galleryQuery ?? player.name;

  const [votoResult, homeResult] = await Promise.allSettled([
    fetchVotoCategoryImages(ALL_VOTO_CATEGORY),
    // 다인 홈 메인 폴더 (folderId 생략 → NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID)
    fetchDriveGalleryImages(),
  ]);

  const votoImages =
    votoResult.status === "fulfilled" ? filterImagesByQuery(votoResult.value, query) : [];

  const homeImages =
    homeResult.status === "fulfilled"
      ? homeResult.value
          .filter((img) => withTagsMatchPlayer(img.withTags, player))
          .map(driveImageToVotoImage)
      : [];

  // 두 소스 모두 실패했다면 에러를 던져 500 으로 알린다.
  if (votoResult.status === "rejected" && homeResult.status === "rejected") {
    const reason =
      votoResult.reason instanceof Error ? votoResult.reason.message : "사진을 불러오지 못했습니다.";
    throw new Error(reason);
  }

  const seen = new Set<string>();
  const merged: VotoImage[] = [];
  for (const img of [...votoImages, ...homeImages]) {
    if (seen.has(img.id)) continue;
    seen.add(img.id);
    merged.push(img);
  }

  // 최신 우선 — 컴포넌트가 sortTimeMs 로 다시 정렬하지만 안전하게 미리 정렬.
  merged.sort((a, b) => b.sortTimeMs - a.sortTimeMs);
  return merged;
}
