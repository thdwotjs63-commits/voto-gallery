import type { DriveImage } from "@/lib/drive-gallery-data";

/** 기록 시트 date(YYYY-MM-DD) → 갤러리 scheduleDateKey(YYYYMMDD) */
export function recordDateToScheduleDateKey(date: string): number | null {
  const match = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const key = Number(`${match[1]}${match[2]}${match[3]}`);
  return Number.isFinite(key) ? key : null;
}

/** URL dateKey 쿼리(YYYYMMDD 또는 YYYY-MM-DD) */
export function parseGalleryDateKeyParam(raw: string): number | null {
  const t = raw.trim();
  if (/^\d{8}$/.test(t)) {
    const key = Number(t);
    return Number.isFinite(key) ? key : null;
  }
  return recordDateToScheduleDateKey(t);
}

export function resolveGalleryFolderForDateKey(
  images: Pick<DriveImage, "scheduleDateKey" | "folderName" | "folderSortKey">[],
  dateKey: number
): string | null {
  const folders = new Map<string, number>();
  for (const image of images) {
    if (image.scheduleDateKey !== dateKey || !image.folderName) continue;
    const sortKey = image.folderSortKey || image.scheduleDateKey || 0;
    const prev = folders.get(image.folderName) ?? 0;
    if (sortKey > prev) folders.set(image.folderName, sortKey);
  }
  const best = [...folders.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
}

export function buildGalleryDateKeySet(
  images: Pick<DriveImage, "scheduleDateKey">[]
): Set<number> {
  const keys = new Set<number>();
  for (const image of images) {
    if (image.scheduleDateKey > 0) keys.add(image.scheduleDateKey);
  }
  return keys;
}

export function hasGalleryPhotosForRecordDate(
  galleryDateKeys: Set<number>,
  recordDate: string
): boolean {
  const dateKey = recordDateToScheduleDateKey(recordDate);
  return dateKey != null && galleryDateKeys.has(dateKey);
}

/** 기록 날짜 클릭 시 갤러리로 이동 (dateKey 쿼리) */
export function buildGalleryLinkForRecordDate(date: string): string {
  const dateKey = recordDateToScheduleDateKey(date);
  if (!dateKey) return "/";
  return `/?dateKey=${dateKey}`;
}
