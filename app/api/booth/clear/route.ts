import { NextRequest, NextResponse } from "next/server";
import { del, list } from "@vercel/blob";
import { rejectInvalidBoothRequest } from "@/lib/booth-auth";
import { boothBlobToken } from "@/lib/booth-blob";
import { boothDateKey, boothDayPrefix } from "@/lib/booth-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = rejectInvalidBoothRequest(req, "booth/clear");
  if (denied) return denied;

  const date = boothDateKey();
  const token = boothBlobToken();
  let deleted = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: boothDayPrefix(date), cursor, limit: 1000, token });
      if (page.blobs.length > 0) {
        await del(
          page.blobs.map((b) => b.url),
          { token }
        );
        deleted += page.blobs.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[booth/clear] failed: ${message}`);
    return NextResponse.json({ error: `clear failed: ${message}`, deleted }, { status: 500 });
  }

  return NextResponse.json({ date, deleted });
}
