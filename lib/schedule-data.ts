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
};

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

export async function fetchSchedule(csvUrl: string): Promise<Match[]> {
  const res = await fetch(csvUrl, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Schedule CSV fetch failed (${res.status})`);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return (parsed.data ?? [])
    .map((row) => ({
      date: (row.date ?? "").trim(),
      startTime: (row.start_time ?? "").trim(),
      category: (row.category ?? "").trim(),
      tournament: (row.tournament ?? "").trim(),
      round: (row.round ?? "").trim(),
      teamA: (row.team_a ?? "").trim(),
      teamB: (row.team_b ?? "").trim(),
      venue: (row.venue ?? "").trim(),
      court: (row.court ?? "").trim(),
      note: (row.note ?? "").trim(),
      scoreA: (row.score_a ?? "").trim(),
      scoreB: (row.score_b ?? "").trim(),
    }))
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
