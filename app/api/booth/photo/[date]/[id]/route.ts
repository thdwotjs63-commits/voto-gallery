import { NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { BOOTH_BLOB_ACCESS, boothBlobToken } from "@/lib/booth-blob";
import { boothPhotoBlobPath, isBoothDateKey, isBoothPhotoId } from "@/lib/booth-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string; id: string }> }
) {
  const { date, id } = await params;
  if (!isBoothDateKey(date) || !isBoothPhotoId(id)) return notFound();

  try {
    const result = await get(boothPhotoBlobPath(date, id), {
      access: BOOTH_BLOB_ACCESS,
      token: boothBlobToken(),
    });
    if (!result || result.statusCode !== 200) return notFound();

    const headers = new Headers({
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    });
    if (Number.isFinite(result.blob.size)) {
      headers.set("Content-Length", String(result.blob.size));
    }
    return new Response(result.stream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[booth/photo] blob get failed: ${message}`);
    return new Response("Failed to load photo", {
      status: 500,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }
}
