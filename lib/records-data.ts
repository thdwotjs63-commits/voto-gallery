import Papa from "papaparse";

export type PlayerRecord = {
  date: string;
  opponent: string;
  competition: string;
  round: string;
  points: number | null;
  attackSuccess: string;
  serveAce: number | null;
  block: number | null;
  error: number | null;
  setSuccess: string;
  setSuccessCount: number | null;
  setSuccessCountTotal: number | null;
  setAvg: number | null;
  setSuccessRate: string;
  videoUrl: string;
  note: string;
  homeAway: string;
};

export type RecordsSheet = {
  id: string;
  name: string;
  records: PlayerRecord[];
};

type RawRow = Record<string, string>;

function toNum(v: string): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseCountValue(v: string): number | null {
  const t = (v ?? "").trim().replace(/,/g, "");
  if (!t) return null;
  return toNum(t);
}

function parseSetSuccessCount(v: string): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const fraction = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (fraction) return Number(fraction[1]);
  return toNum(t);
}

function parseHomeAway(row: RawRow, note: string): string {
  const dedicated = (row.home_away ?? "").trim();
  if (dedicated === "홈" || dedicated === "원정") return dedicated;
  if (note === "홈" || note === "원정") return note;
  return "";
}

function parseNote(note: string): string {
  if (note === "홈" || note === "원정") return "";
  return note;
}

function mapRow(row: RawRow): PlayerRecord {
  const note = (row.note ?? "").trim();
  return {
    date: (row.date ?? "").trim(),
    opponent: (row.opponent ?? "").trim(),
    competition: (row.competition ?? "").trim(),
    round: (row.round ?? "").trim(),
    points: toNum(row.points),
    attackSuccess: (row.attack_success ?? "").trim(),
    serveAce: toNum(row.serve_ace),
    block: toNum(row.block),
    error: toNum(row.error),
    setSuccess: (row.set_success ?? "").trim(),
    setSuccessCount: parseSetSuccessCount(row.set_success ?? ""),
    setSuccessCountTotal: parseCountValue(row.set_success_count ?? ""),
    setAvg: toNum(row.set_avg ?? ""),
    setSuccessRate: (row.set_success_rate ?? "").trim(),
    videoUrl: (row.video_url ?? "").trim(),
    note: parseNote(note),
    homeAway: parseHomeAway(row, note),
  };
}

export function parseRecordsSheetsEnv(raw: string | undefined): { name: string; gid: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split("|")
    .map((part) => {
      const colon = part.lastIndexOf(":");
      if (colon <= 0) return null;
      const name = part.slice(0, colon).trim();
      const gid = part.slice(colon + 1).trim();
      if (!name || !gid) return null;
      return { name, gid };
    })
    .filter((sheet): sheet is { name: string; gid: string } => sheet !== null);
}

export function buildSheetCsvUrl(baseCsvUrl: string, gid: string): string {
  const url = new URL(baseCsvUrl);
  url.searchParams.set("gid", gid);
  url.searchParams.set("single", "true");
  url.searchParams.set("output", "csv");
  return url.toString();
}

export async function fetchRecords(csvUrl: string): Promise<PlayerRecord[]> {
  const res = await fetch(csvUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Records CSV fetch failed (${res.status})`);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return (parsed.data ?? [])
    .map(mapRow)
    .filter((r) => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchAllRecordsSheets(
  baseCsvUrl: string,
  sheetsConfig: { name: string; gid: string }[]
): Promise<RecordsSheet[]> {
  if (!sheetsConfig.length) {
    const records = await fetchRecords(baseCsvUrl);
    return [{ id: "default", name: "전체", records }];
  }

  const sheets = await Promise.all(
    sheetsConfig.map(async ({ name, gid }) => ({
      id: gid,
      name,
      records: await fetchRecords(buildSheetCsvUrl(baseCsvUrl, gid)),
    }))
  );

  return sheets.filter((sheet) => sheet.records.length > 0 || sheetsConfig.length === 1);
}

export function parsePercent(v: string): number | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (t.includes("%")) {
    const m = t.match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return n * 100;
  return n;
}

export function formatRate(v: string): string {
  const t = (v ?? "").trim();
  if (!t) return "-";
  if (t.includes("%")) return t;
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  if (n <= 1) {
    const pct = n * 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
  }
  return `${n}%`;
}

export function isPlayedRecord(r: PlayerRecord): boolean {
  return !r.note.includes("미출전");
}

export function averagePercent(values: string[]): string {
  const nums = values.map(parsePercent).filter((v): v is number => v !== null);
  if (!nums.length) return "-";
  const avg = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  return `${Number.isInteger(avg) ? avg : avg.toFixed(1)}%`;
}

export function displayRecordValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string" && !v.trim()) return "-";
  return String(v);
}
