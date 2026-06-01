import Papa from "papaparse";

export type PlayerRecord = {
  date: string;
  opponent: string;
  competition: string;
  round: string;
  points: number | null;
  totalPoints: number | null;
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

function splitNote(note: string): { homeAway: string; note: string } {
  if (note === "홈" || note === "원정") return { homeAway: note, note: "" };
  const match = note.match(/^(홈|원정)(?:\s*[·|,]\s*|\s+)(.+)$/);
  if (match) return { homeAway: match[1], note: match[2].trim() };
  return { homeAway: "", note };
}

function parseHomeAway(row: RawRow, note: string): string {
  const dedicated = (row.home_away ?? "").trim();
  if (dedicated === "홈" || dedicated === "원정") return dedicated;
  return splitNote(note).homeAway;
}

function parseNote(note: string): string {
  return splitNote(note).note;
}

function mapRow(row: RawRow): PlayerRecord {
  const note = (row.note ?? "").trim();
  return {
    date: (row.date ?? "").trim(),
    opponent: (row.opponent ?? "").trim(),
    competition: (row.competition ?? "").trim(),
    round: (row.round ?? "").trim(),
    points: toNum(row.points),
    totalPoints: parseCountValue(row.total_points ?? ""),
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
  url.searchParams.set("output", "csv");
  url.searchParams.delete("single");
  return url.toString();
}

export async function fetchRecords(csvUrl: string): Promise<PlayerRecord[]> {
  const res = await fetch(csvUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Records CSV fetch failed (${res.status})`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error("Records CSV fetch failed (invalid response)");
  if (!text.trim()) return [];
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return (parsed.data ?? [])
    .map(mapRow)
    .filter((r) => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .filter(isSeasonRecord)
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
    sheetsConfig.map(async ({ name, gid }) => {
      try {
        const records = await fetchRecords(buildSheetCsvUrl(baseCsvUrl, gid));
        return { id: gid, name, records };
      } catch {
        return { id: gid, name, records: [] };
      }
    })
  );

  return sheets;
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

export function formatPercentDisplay(n: number): string {
  return `${Number(n.toFixed(2))}%`;
}

export function formatRate(v: string): string {
  const t = (v ?? "").trim();
  if (!t) return "-";
  const parsed = parsePercent(t);
  if (parsed === null) return t.includes("%") ? t : "-";
  return formatPercentDisplay(parsed);
}

export function isSeasonRecord(r: PlayerRecord): boolean {
  const competition = r.competition.trim();
  if (!competition) return true;
  // V리그 포스트시즌(플레이오프·챔프전)은 시즌 기록에서 제외
  if (/V리그/.test(competition) && /플레이오프|챔프전/.test(competition)) return false;
  return true;
}

export function isPlayedRecord(r: PlayerRecord): boolean {
  return isSeasonRecord(r) && !r.note.includes("미출전");
}

export function averagePercent(values: string[]): string {
  const nums = values.map(parsePercent).filter((v): v is number => v !== null);
  if (!nums.length) return "-";
  const avg = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  return formatPercentDisplay(avg);
}

export function displayRecordValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string" && !v.trim()) return "-";
  return String(v);
}

export type RecordMoment = {
  emoji: string;
  label: string;
  tone: "amber" | "rose" | "sky" | "violet";
};

const PANGPANG_PLAYER_DATES = new Set([
  "2021-10-20",
  "2021-12-17",
  "2022-01-07",
  "2022-12-08",
  "2023-11-23",
  "2024-01-05",
  "2024-01-31",
  "2024-10-23",
  "2025-11-22",
  "2025-12-06",
  "2025-12-25",
  "2026-02-13",
]);

const RECORD_MOMENT_RULES: {
  match: (r: PlayerRecord) => boolean;
  moment: RecordMoment;
}[] = [
  {
    match: (r) => r.note.includes("커피") || r.date === "2026-03-05",
    moment: { emoji: "☕", label: "커피차 역조공", tone: "amber" },
  },
  {
    match: (r) => r.note.includes("팬사인") || r.date === "2026-03-08",
    moment: { emoji: "✍️", label: "팬사인회", tone: "rose" },
  },
  {
    match: (r) => r.note.includes("팡팡") || PANGPANG_PLAYER_DATES.has(r.date),
    moment: { emoji: "👏", label: "팡팡플레이어", tone: "sky" },
  },
  {
    match: (r) => r.note.includes("3R MVP") || r.date === "2025-12-31",
    moment: { emoji: "🏆", label: "3R MVP", tone: "violet" },
  },
];

export function getRecordMoments(r: PlayerRecord): RecordMoment[] {
  return RECORD_MOMENT_RULES.filter((rule) => rule.match(r)).map((rule) => rule.moment);
}

export function getRecordMoment(r: PlayerRecord): RecordMoment | null {
  return getRecordMoments(r)[0] ?? null;
}

export function getLatestSetSuccessCountTotal(records: PlayerRecord[]): number | null {
  const latest = records
    .filter((r) => isPlayedRecord(r) && r.setSuccessCountTotal != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return latest?.setSuccessCountTotal ?? null;
}

export function getLatestTotalPoints(records: PlayerRecord[]): number | null {
  const latest = records
    .filter((r) => isPlayedRecord(r) && r.totalPoints != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return latest?.totalPoints ?? null;
}
