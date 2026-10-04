/** 행사 모드 QR 공유 — 클라이언트/서버 공용 (Node 전용 API 사용 금지) */

export const BOOTH_KEY_HEADER = "x-booth-key";
export const BOOTH_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const BOOTH_BLOB_ROOT = "booth";
const BOOTH_TIME_ZONE = "Asia/Seoul";

/** 한국 시간 기준 YYYYMMDD */
export function boothDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOTH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}${pick("month")}${pick("day")}`;
}

export function formatBoothDateLabel(dateKey: string): string {
  return `${dateKey.slice(0, 4)}.${dateKey.slice(4, 6)}.${dateKey.slice(6, 8)}`;
}

export function isBoothDateKey(value: string): boolean {
  return /^\d{8}$/.test(value);
}

export function isBoothPhotoId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function boothDayPrefix(dateKey: string): string {
  return `${BOOTH_BLOB_ROOT}/${dateKey}/`;
}

export function boothPhotoBlobPath(dateKey: string, id: string): string {
  return `${boothDayPrefix(dateKey)}${id}.jpg`;
}

export function boothPhotoPagePath(dateKey: string, id: string): string {
  return `/p/${dateKey}/${id}`;
}

/** fetch 헤더는 ASCII 만 허용돼서 키를 인코딩해 보냄 */
export function encodeBoothKeyHeader(key: string): string {
  return encodeURIComponent(key.trim());
}

export function decodeBoothKeyHeader(raw: string | null): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return "";
  }
}
