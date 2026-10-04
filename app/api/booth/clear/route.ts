import { NextRequest, NextResponse } from "next/server";
import { rejectInvalidBoothRequest } from "@/lib/booth-auth";
import { boothBlobDel, boothBlobList } from "@/lib/booth-blob";
import { boothDateKey, boothDayPrefix } from "@/lib/booth-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "booth/clear";

export async function POST(req: NextRequest) {
  const denied = rejectInvalidBoothRequest(req, SCOPE);
  if (denied) return denied;

  const date = boothDateKey();
  let deleted = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await boothBlobList(SCOPE, { prefix: boothDayPrefix(date), cursor, limit: 1000 });
      if (page.blobs.length > 0) {
        await boothBlobDel(
          SCOPE,
          page.blobs.map((b) => b.url)
        );
        deleted += page.blobs.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${SCOPE}] failed: ${message}`);
    return NextResponse.json({ error: `clear failed: ${message}`, deleted }, { status: 500 });
  }

  return NextResponse.json({ date, deleted });
}
