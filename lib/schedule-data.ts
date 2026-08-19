import Papa from "papaparse";

export type Match = {
  date: string;
  startTime: string;
  category: string;
  tournament: string;
  round: string;
  teamA: string;
  teamB: string;
  venue: string;
  court: string;
  note: string;
  scoreA: string;
  scoreB: string;
  url: string;
  dain: boolean;
  /** 성인 대표팀(팀코리아) 경기 */
  natl: boolean;
  /** 홈/원정 (예: "홈", "원정") */
  homeAway: string;
};

export type OngoingTournament = {
  tournament: string;
  startDate: string;
  endDate: string;
  wins: number;
  losses: number;
};

export type NextMatch = {
  date: string;
  startTime: string;
  tournament: string;
  teamA: string;
  teamB: string;
  venue: string;
  scoreA: string;
  scoreB: string;
};

export function getNextDaeinMatch(rows: Match[], today = new Date()): NextMatch | null {
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const daein = rows.filter((r) => r.dain && r.date && r.date >= todayStr);
  daein.sort((a, b) =>
    a.date === b.date
      ? (a.startTime ?? "").localeCompare(b.startTime ?? "")
      : a.date.localeCompare(b.date)
  );
  const m = daein[0];
  if (!m) return null;
  return {
    date: m.date,
    startTime: m.startTime ?? "",
    tournament: m.tournament ?? "",
    teamA: m.teamA ?? "",
    teamB: m.teamB ?? "",
    venue: m.venue ?? "",
    scoreA: m.scoreA ?? "",
    scoreB: m.scoreB ?? "",
  };
}

const DAEIN_TEAMS = ["현대건설", "대한민국"];
const KOREA_TEAMS = ["대한민국"];

function daeinIsTeamA(row: Match): boolean {
  return DAEIN_TEAMS.some((t) => (row.teamA ?? "").includes(t));
}

export type TeamKoreaRecord = {
  wins: number;
  losses: number;
  /** 현재 연승 수 (직전 경기부터 이어진 승수) */
  streak: number;
  /** true면 연승 중, false면 직전 경기 패 */
  streakActive: boolean;
};

export function getTeamKoreaRecord(rows: Match[]): TeamKoreaRecord | null {
  const games = rows.filter((r) => {
    if (!r.natl || !r.date) return false;
    if (!r.date.startsWith("2026")) return false;
    const a = Number(r.scoreA);
    const b = Number(r.scoreB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a === 0 && b === 0) return false;
    return true;
  });

  if (games.length === 0) return null;

  games.sort((x, y) =>
    x.date === y.date
      ? (x.startTime ?? "").localeCompare(y.startTime ?? "")
      : x.date.localeCompare(y.date)
  );

  const results = games.map((r) => {
    const a = Number(r.scoreA);
    const b = Number(r.scoreB);
    const koreaIsA = KOREA_TEAMS.some((t) => (r.teamA ?? "").includes(t));
    const myScore = koreaIsA ? a : b;
    const oppScore = koreaIsA ? b : a;
    return myScore > oppScore;
  });

  const wins = results.filter((w) => w).length;
  const losses = results.length - wins;

  let streak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) streak++;
    else break;
  }
  const streakActive = results[results.length - 1] === true;

  return { wins, losses, streak, streakActive };
}

export function getOngoingDaeinTournaments(
  rows: Match[],
  today = new Date()
): OngoingTournament[] {
  const daeinRows = rows.filter((r) => r.dain && r.tournament && r.date);

  const map = new Map<string, Match[]>();
  for (const r of daeinRows) {
    if (!map.has(r.tournament)) map.set(r.tournament, []);
    map.get(r.tournament)!.push(r);
  }

  const todayStr = today.toISOString().slice(0, 10);
  const result: OngoingTournament[] = [];

  for (const [tournament, group] of map) {
    const dates = group.map((r) => r.date).sort();
    const min = dates[0];
    const max = dates[dates.length - 1];
    if (todayStr < min || todayStr > max) continue;

    let wins = 0;
    let losses = 0;
    for (const r of group) {
      const a = Number(r.scoreA);
      const b = Number(r.scoreB);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a === 0 && b === 0) continue;
      const isA = daeinIsTeamA(r);
      const myScore = isA ? a : b;
      const oppScore = isA ? b : a;
      if (myScore > oppScore) wins++;
      else if (myScore < oppScore) losses++;
    }

    result.push({ tournament, startDate: min, endDate: max, wins, losses });
  }

  result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return result;
}

export type TournamentGroup = {
  tournament: string;
  category: string;
  venue: string;
  matches: Match[];
};

export type DaySchedule = {
  date: string;
  groups: TournamentGroup[];
  totalMatches: number;
};

type RawRow = Record<string, string>;

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

export async function fetchSchedule(csvUrl: string): Promise<Match[]> {
  const res = await fetch(csvUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Schedule CSV fetch failed (${res.status})`);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return (parsed.data ?? [])
    .map((row) => {
      const note = (row.note ?? "").trim();
      return {
      date: (row.date ?? "").trim(),
      startTime: (row.start_time ?? "").trim(),
      category: (row.category ?? "").trim(),
      tournament: (row.tournament ?? "").trim(),
      round: (row.round ?? "").trim(),
      teamA: (row.team_a ?? "").trim(),
      teamB: (row.team_b ?? "").trim(),
      venue: (row.venue ?? "").trim(),
      court: (row.court ?? "").trim(),
      note,
      scoreA: (row.score_a ?? "").trim(),
      scoreB: (row.score_b ?? "").trim(),
      url: (row.url ?? "").trim(),
      dain: (row.dain ?? "").trim() === "1",
      natl: (row.natl ?? "").trim() === "1",
      homeAway: parseHomeAway(row, note),
    };
    })
    .filter((m) => m.date && /^\d{4}-\d{2}-\d{2}$/.test(m.date));
}

export function groupByDate(matches: Match[]): DaySchedule[] {
  const dateMap = new Map<string, Match[]>();
  for (const m of matches) {
    if (!dateMap.has(m.date)) dateMap.set(m.date, []);
    dateMap.get(m.date)!.push(m);
  }
  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMatches]) => {
      const sorted = [...dayMatches].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const tMap = new Map<string, TournamentGroup>();
      for (const m of sorted) {
        const key = `${m.tournament}__${m.venue}`;
        if (!tMap.has(key)) {
          tMap.set(key, { tournament: m.tournament, category: m.category, venue: m.venue, matches: [] });
        }
        tMap.get(key)!.matches.push(m);
      }
      return { date, groups: Array.from(tMap.values()), totalMatches: sorted.length };
    });
}

// ICS 형식용 날짜 변환: "2026-07-02" + "10:00" → "20260702T100000"
function toICSDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [hh, mm] = (time || "00:00").split(":");
  return `${y}${m}${d}T${(hh ?? "00").padStart(2, "0")}${(mm ?? "00").padStart(2, "0")}00`;
}

function escapeICS(text: string): string {
  return (text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// 대회 그룹 하나의 VEVENT 블록 생성
function buildTournamentVEVENT(group: TournamentGroup, date: string): string[] {
  const times = group.matches
    .map((m) => m.startTime)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const startTime = times[0] || "09:00";

  // 종료 시간: 마지막 경기 시작 + 2시간 (배구 경기 평균 길이 가정)
  const lastTime = times[times.length - 1] || startTime;
  const [lh, lm] = lastTime.split(":");
  const endHour = String(Math.min(23, Number(lh) + 2)).padStart(2, "0");
  const endTime = `${endHour}:${lm ?? "00"}`;

  const dtStart = toICSDateTime(date, startTime);
  const dtEnd = toICSDateTime(date, endTime);
  const uid = `${date}-${group.tournament}-${group.venue}`.replace(/\s/g, "") + "@voto-gallery";

  const description = group.matches
    .map((m) => {
      const r = m.round ? ` (${m.round})` : "";
      return `${m.startTime} ${m.teamA} vs ${m.teamB}${r}`;
    })
    .join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(`[${group.category}] ${group.tournament}`)}`,
    `LOCATION:${escapeICS(group.venue)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    "END:VEVENT",
  ];
}

const ICS_CALENDAR_HEADER = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//voto-gallery//volleyball-schedule//KO",
  "CALSCALE:GREGORIAN",
] as const;

// 대회 그룹 하나를 .ics 문자열로 변환
export function buildTournamentICS(group: TournamentGroup, date: string): string {
  return [...ICS_CALENDAR_HEADER, ...buildTournamentVEVENT(group, date), "END:VCALENDAR"].join("\r\n");
}

// 전체 일정을 하나의 .ics 파일로 변환
export function buildAllScheduleICS(daySchedules: DaySchedule[]): string {
  const events = daySchedules.flatMap((day) =>
    day.groups.flatMap((group) => buildTournamentVEVENT(group, day.date))
  );
  return [...ICS_CALENDAR_HEADER, ...events, "END:VCALENDAR"].join("\r\n");
}
