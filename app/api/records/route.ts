import { NextResponse } from "next/server";
import { fetchAllRecordsSheets, parseRecordsSheetsEnv } from "@/lib/records-data";

export const revalidate = 300;

export async function GET() {
  try {
    const csvUrl = process.env.RECORDS_CSV_URL;
    if (!csvUrl) {
      return NextResponse.json({ error: "RECORDS_CSV_URL not set" }, { status: 500 });
    }
    const sheets = await fetchAllRecordsSheets(csvUrl, parseRecordsSheetsEnv(process.env.RECORDS_SHEETS));
    return NextResponse.json({ sheets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
