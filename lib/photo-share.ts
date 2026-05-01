import { SITE_URL } from "@/lib/seo-metadata";

/**
 * 클립보드 2번째 줄. 본문에 `daeni.kr`만 있으면 카톡이 루트 URL만 링크로 잡는 경우가 있어,
 * 도메인 단독 노출은 피하고 상세 URL은 항상 첫 줄에 둔다.
 */
export const PHOTO_SHARE_CLIPBOARD_BYLINE = "Kim Dain | Voto Gallery";

/** 홈(`/?photo=`)만 사용해 공유·딥링크 시 별도 라우트 404를 피한다. */
export function buildPhotoDetailPageUrl(photoId: string): string {
  const base = SITE_URL.replace(/\/$/, "") || "https://daeni.kr";
  const url = new URL(`${base}/`);
  url.searchParams.set("photo", photoId);
  return url.toString();
}

/** 카톡·메신저가 첫 줄의 https URL을 링크로 쓰도록 상세 주소를 맨 위에 둔다. */
export function buildPhotoShareClipboardText(photoId: string): string {
  const url = buildPhotoDetailPageUrl(photoId);
  return `${url}\n\n${PHOTO_SHARE_CLIPBOARD_BYLINE}`;
}
