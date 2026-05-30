import { NextResponse } from "next/server";
import { fetchSchedule } from "@/lib/schedule-data";

export const revalidate = 300;

export async function GET() {
  try {
    const csvUrl = process.env.SCHEDULE_CSV_URL;
    if (!csvUrl) {
      return NextResponse.json({ error: "SCHEDULE_CSV_URL not set" }, { status: 500 });
    }
    const matches = await fetchSchedule(csvUrl);
    return NextResponse.json(matches);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
