/** 행사 모드 사진 Blob — 서버 전용 */

/** 스토어가 Private 이라 모든 사진은 토큰으로만 읽고 쓴다 */
export const BOOTH_BLOB_ACCESS = "private" as const;

export function boothBlobToken(): string | undefined {
  const token = (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim();
  return token || undefined;
}
