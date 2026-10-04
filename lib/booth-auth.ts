import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { BOOTH_BLOB_MISSING_ENV, hasBoothBlobCredentials } from "@/lib/booth-blob";
import { BOOTH_KEY_HEADER, decodeBoothKeyHeader } from "@/lib/booth-share";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** 통과하면 null, 아니면 그대로 반환할 에러 응답 (환경변수 누락 → 500, 키 불일치 → 401) */
export function rejectInvalidBoothRequest(req: NextRequest, scope: string): NextResponse | null {
  const missing: string[] = [];
  if (!(process.env.BOOTH_KEY ?? "").trim()) missing.push("BOOTH_KEY");
  if (!hasBoothBlobCredentials()) missing.push(BOOTH_BLOB_MISSING_ENV);
  if (missing.length > 0) {
    console.error(`[${scope}] missing env: ${missing.join(", ")}`);
    return NextResponse.json({ error: `missing ${missing.join(", ")}` }, { status: 500 });
  }
  const expected = (process.env.BOOTH_KEY ?? "").trim();
  const provided = decodeBoothKeyHeader(req.headers.get(BOOTH_KEY_HEADER));
  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    return NextResponse.json({ error: "Invalid booth key" }, { status: 401 });
  }
  return null;
}
