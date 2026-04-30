import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackBody = {
  sessionId?: string;
};

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function toIpHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = ((await req.json()) as TrackBody) ?? {};
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const ipHash = toIpHash(getClientIp(req));
    const visitDate = new Date().toISOString().slice(0, 10);
    const userAgent = req.headers.get("user-agent") ?? "";

    const { data: duplicateRows, error: duplicateError } = await supabase
      .from("visitor_logs")
      .select("id")
      .eq("visit_date", visitDate)
      .or(`ip_hash.eq.${ipHash},session_id.eq.${sessionId}`)
      .limit(1);

    if (duplicateError) {
      throw duplicateError;
    }

    if ((duplicateRows ?? []).length > 0) {
      return NextResponse.json({ counted: false, reason: "duplicate" });
    }

    const { error: insertError } = await supabase.from("visitor_logs").insert({
      visit_date: visitDate,
      ip_hash: ipHash,
      session_id: sessionId,
      user_agent: userAgent,
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ counted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to track visitor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

