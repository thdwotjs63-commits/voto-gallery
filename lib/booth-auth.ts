import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { BOOTH_KEY_HEADER, decodeBoothKeyHeader } from "@/lib/booth-share";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** 통과하면 null, 아니면 그대로 반환할 에러 응답 */
export function rejectInvalidBoothKey(req: NextRequest): NextResponse | null {
  const expected = (process.env.BOOTH_KEY ?? "").trim();
  if (!expected) {
    return NextResponse.json({ error: "BOOTH_KEY is not configured" }, { status: 503 });
  }
  const provided = decodeBoothKeyHeader(req.headers.get(BOOTH_KEY_HEADER));
  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    return NextResponse.json({ error: "Invalid booth key" }, { status: 401 });
  }
  return null;
}
