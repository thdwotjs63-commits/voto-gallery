/** 생일 메시지북 비밀 주소 / 검토 키 확인 — 서버 전용 */

import { createHash, timingSafeEqual } from "node:crypto";

export const BOOK_TOKEN_HEADER = "x-book-token";
export const BOOK_ADMIN_KEY_HEADER = "x-book-admin-key";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

function decodeHeader(raw: string | null): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return "";
  }
}

/** BOOK_TOKEN 이 비어 있으면 어떤 토큰도 통과하지 않는다 */
export function isValidBookToken(token: string | null | undefined): boolean {
  return safeEqual((token ?? "").trim(), (process.env.BOOK_TOKEN ?? "").trim());
}

export function hasBookAdminKey(): boolean {
  return Boolean((process.env.BOOK_ADMIN_KEY ?? "").trim());
}

export function isValidBookAdminKey(key: string | null | undefined): boolean {
  return safeEqual((key ?? "").trim(), (process.env.BOOK_ADMIN_KEY ?? "").trim());
}

export function readBookAuthHeaders(headers: Headers) {
  return {
    token: decodeHeader(headers.get(BOOK_TOKEN_HEADER)),
    adminKey: decodeHeader(headers.get(BOOK_ADMIN_KEY_HEADER)),
  };
}
