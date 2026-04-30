import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VisitorRow = {
  visit_date: string;
  ip_hash: string;
};

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minusDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function GET(req: NextRequest) {
  const auth = req.nextUrl.searchParams.get("auth") ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!adminPassword || auth !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const today = new Date();
    const todayKey = toYmd(today);
    const yesterdayKey = toYmd(minusDays(today, 1));
    const start7dKey = toYmd(minusDays(today, 6));

    const { data: sevenDayRows, error: sevenDayError } = await supabase
      .from("visitor_logs")
      .select("visit_date,ip_hash")
      .gte("visit_date", start7dKey)
      .lte("visit_date", todayKey);

    if (sevenDayError) {
      throw sevenDayError;
    }

    const uniqueByDay = new Map<string, Set<string>>();
    for (const row of (sevenDayRows ?? []) as VisitorRow[]) {
      const key = row.visit_date;
      if (!uniqueByDay.has(key)) {
        uniqueByDay.set(key, new Set<string>());
      }
      uniqueByDay.get(key)?.add(row.ip_hash);
    }

    const recent7Days = Array.from({ length: 7 }).map((_, idx) => {
      const day = toYmd(minusDays(today, 6 - idx));
      return {
        date: day,
        uniqueVisitors: uniqueByDay.get(day)?.size ?? 0,
      };
    });

    const { data: allRows, error: allRowsError } = await supabase
      .from("visitor_logs")
      .select("ip_hash");

    if (allRowsError) {
      throw allRowsError;
    }

    const totalUniqueVisitors = new Set(
      (allRows ?? []).map((r) => (r as { ip_hash: string }).ip_hash)
    ).size;

    return NextResponse.json({
      summary: {
        today: uniqueByDay.get(todayKey)?.size ?? 0,
        yesterday: uniqueByDay.get(yesterdayKey)?.size ?? 0,
        totalUnique: totalUniqueVisitors,
      },
      recent7Days,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

