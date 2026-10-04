import { NextRequest, NextResponse } from "next/server";
import { del, list } from "@vercel/blob";
import { rejectInvalidBoothKey } from "@/lib/booth-auth";
import { boothDateKey, boothDayPrefix } from "@/lib/booth-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = rejectInvalidBoothKey(req);
  if (denied) return denied;

  const date = boothDateKey();
  let deleted = 0;
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: boothDayPrefix(date), cursor, limit: 1000 });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((b) => b.url));
        deleted += page.blobs.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("[booth/clear] failed", error);
    return NextResponse.json({ error: "Clear failed", deleted }, { status: 500 });
  }

  return NextResponse.json({ date, deleted });
}
