/** 생일 기념 전시·사진 월드컵(/exhibition) — 전시 사진 고르기 */

import { driveLh3FullDisplayUrl, type DriveImage } from "./drive-gallery-data";

/** "#" 를 뗀 소문자 태그 기준. exhibition_01 → 전시 순번 1 */
export const EXHIBITION_ORDER_TAG_RE = /^exhibition_(\d+)$/;
const EXHIBITION_PLAIN_TAG = "exhibition";

export type ExhibitionPhoto = {
  /** 드라이브 파일 ID — 월드컵 기록의 photo_id */
  photoId: string;
  src: string;
  width: number;
  height: number;
};

/**
 * 전시 순번. 전시 사진이 아니면 null.
 * 번호 없는 #exhibition 이나 정수로 못 읽는 순번은 Infinity(번호 있는 사진들 뒤).
 * 순번 태그가 여러 개면 가장 작은 값.
 */
export function exhibitionOrder(tags: readonly string[]): number | null {
  let order: number | null = null;
  for (const raw of tags) {
    const tag = raw.replace(/^#/, "").toLowerCase();
    const match = EXHIBITION_ORDER_TAG_RE.exec(tag);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      order = Math.min(order ?? Infinity, Number.isSafeInteger(n) ? n : Infinity);
    } else if (tag === EXHIBITION_PLAIN_TAG) {
      order ??= Infinity;
    }
  }
  return order;
}

const compareName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** 전시 순번 오름차순, 같은 순번은 파일 이름 순 */
export function selectExhibitionPhotos(images: readonly DriveImage[]): ExhibitionPhoto[] {
  return images
    .flatMap((image) => {
      const order = image.id ? exhibitionOrder(image.tags) : null;
      return order === null ? [] : [{ image, order }];
    })
    .sort((a, b) =>
      a.order === b.order ? compareName(a.image.name, b.image.name) : a.order < b.order ? -1 : 1
    )
    .map(({ image: { id, width, height } }) => ({
      photoId: id,
      src: driveLh3FullDisplayUrl(id),
      width,
      height,
    }));
}
