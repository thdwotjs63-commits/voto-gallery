import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { rejectInvalidBoothKey } from "@/lib/booth-auth";
import { BOOTH_UPLOAD_MAX_BYTES, boothDateKey, boothPhotoBlobPath } from "@/lib/booth-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function POST(req: NextRequest) {
  const denied = rejectInvalidBoothKey(req);
  if (denied) return denied;

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "image/jpeg") {
    return NextResponse.json({ error: "Content-Type must be image/jpeg" }, { status: 415 });
  }
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > BOOTH_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length > BOOTH_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  if (!isJpeg(body)) {
    return NextResponse.json({ error: "Body is not a JPEG image" }, { status: 400 });
  }

  const date = boothDateKey();
  const id = crypto.randomUUID();
  try {
    await put(boothPhotoBlobPath(date, id), Buffer.from(body), {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/jpeg",
    });
  } catch (error) {
    console.error("[booth/upload] blob put failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ id, date }, { status: 201 });
}
