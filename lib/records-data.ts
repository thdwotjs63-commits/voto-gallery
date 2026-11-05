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
  setAttempts: number | null;
  setAvg: number | null;
  setSuccessRate: string;
  /** CSV set_success_rate 원본 (예: "51/113" 또는 "0.43") */
  setSuccessRateRaw: string;
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
  if (dedicated === "홈" || dedicated === "원정" || dedicated === "미출전") return dedicated;
  return splitNote(note).homeAway;
}

function parseNote(note: string): string {
  return splitNote(note).note;
}

function mapRow(row: RawRow): PlayerRecord {
  const note = (row.note ?? "").trim();
  const setSuccessRateRaw = (row.set_success_rate ?? "").trim();
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
    setAttempts: toNum(row.set_attempts ?? ""),
    setAvg: toNum(row.set_avg ?? ""),
    setSuccessRate: setSuccessRateRaw,
    setSuccessRateRaw,
    videoUrl: (row.video_url ?? "").trim(),
    note: parseNote(note),
    homeAway: parseHomeAway(row, note),
  };
}

/**
 * 시즌별 시트 목록 기본값 (환경변수 RECORDS_SHEETS 가 없을 때 사용).
 * 새 시즌을 추가할 때는 여기 맨 앞에 "시즌명:gid" 를 넣으면 된다.
 * (환경변수 RECORDS_SHEETS 가 설정돼 있으면 그쪽이 우선한다.)
 */
export const DEFAULT_RECORDS_SHEETS: { name: string; gid: string }[] = [
  { name: "2026-27", gid: "939464289" },
  { name: "2025-26", gid: "0" },
  { name: "2024-25", gid: "1708980432" },
  { name: "2023-24", gid: "1293342061" },
  { name: "2022-23", gid: "2010085839" },
  { name: "2021-22", gid: "1829532681" },
  { name: "2020-21", gid: "1781609289" },
];

function parseRecordsSheetsRaw(raw: string | undefined): { name: string; gid: string }[] {
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

/**
 * 시즌별 시트 목록을 돌려준다.
 * 코드 기본값(DEFAULT_RECORDS_SHEETS)을 먼저 깔고, 환경변수 RECORDS_SHEETS 에
 * 있는 항목으로 보강·덮어쓴다. 같은 시즌명이 양쪽에 있으면 환경변수의 gid 를 쓴다.
 * → 환경변수를 못 고치는 상황에서도 기본값의 최신 시즌이 항상 노출되고,
 *   나중에 환경변수를 고치면 그쪽이 우선한다.
 */
export function parseRecordsSheetsEnv(raw: string | undefined): { name: string; gid: string }[] {
  const envSheets = parseRecordsSheetsRaw(raw);
  const envByName = new Map(envSheets.map((s) => [s.name, s.gid]));
  const seen = new Set<string>();
  const merged: { name: string; gid: string }[] = [];

  // 1) 기본값 순서대로 깔되, 같은 시즌명이 환경변수에 있으면 그 gid 를 사용
  for (const s of DEFAULT_RECORDS_SHEETS) {
    merged.push({ name: s.name, gid: envByName.get(s.name) ?? s.gid });
    seen.add(s.name);
  }
  // 2) 환경변수에만 있는 시즌(기본값에 없는 것)은 뒤에 덧붙임
  for (const s of envSheets) {
    if (!seen.has(s.name)) {
      merged.push(s);
      seen.add(s.name);
    }
  }
  return merged;
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

export function parseSetFraction(raw: string): { made: number; attempts: number } | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const made = Number(m[1]);
  const attempts = Number(m[2]);
  if (!Number.isFinite(made) || !Number.isFinite(attempts) || attempts <= 0) return null;
  return { made, attempts };
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
  if (/V리그/.test(competition) && /플레이오프|챔프전/.test(competition)) return false;
  return true;
}

export function isPostseasonRecord(r: PlayerRecord): boolean {
  const competition = r.competition.trim();
  if (!competition) return false;
  return /V리그/.test(competition) && /플레이오프|챔프전/.test(competition);
}

/**
 * 아직 치러지지 않은 경기(일정만 깔아둔 행): 기록 필드가 전부 비어 있다.
 * 미래 경기 일정을 시트에 미리 넣어도 "경기 수"나 합계에 잡히지 않게 한다.
 */
export function isUnplayedFixture(r: PlayerRecord): boolean {
  const hasAnyStat =
    r.points != null ||
    r.serveAce != null ||
    r.block != null ||
    r.error != null ||
    r.setAttempts != null ||
    r.setAvg != null ||
    (r.setSuccess?.trim() ?? "") !== "" ||
    (r.attackSuccess?.trim() ?? "") !== "" ||
    (r.setSuccessRateRaw?.trim() ?? "") !== "";
  return !hasAnyStat;
}

export function isDidNotPlay(r: PlayerRecord): boolean {
  return r.note.includes("미출전") || r.homeAway === "미출전";
}

export function isPlayedRecord(r: PlayerRecord): boolean {
  // 미출전으로 표시됐거나, 아직 치르지 않은 미래 경기(기록 전무)는 제외
  return !isDidNotPlay(r) && !isUnplayedFixture(r);
}

/** 출전한 경기 수 (미출전 제외). 통산이면 시즌 시트를 모두 합쳐 넘긴다. */
export function getPlayedGamesCount(records: readonly PlayerRecord[]): number {
  return records.filter(isPlayedRecord).length;
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
