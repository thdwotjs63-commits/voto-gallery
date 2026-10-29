import type { Match } from "./schedule-data";

/** 예: { daysBefore: 7, time: "11:00", label: "선예매(멤버십)" } */
export type TicketRule = {
  daysBefore: number;
  time: string;
  label: string;
};

export type TeamTicketConfig = {
  /** 일정 시트 팀명 매칭 키워드 */
  match: string;
  /** UI 표시명 */
  name: string;
  /** 규칙이 비어 있으면 아직 미지원 */
  rules: readonly TicketRule[];
  enabled: boolean;
};

/** 7구단 확장용. 지금은 현대건설만 규칙 활성 */
export const TEAM_TICKET_CONFIGS: readonly TeamTicketConfig[] = [
  {
    match: "현대건설",
    name: "현대건설",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "11:00", label: "선예매(멤버십)" },
      { daysBefore: 5, time: "11:00", label: "일반예매" },
    ],
  },
  { match: "흥국생명", name: "흥국생명", enabled: false, rules: [] },
  { match: "정관장", name: "정관장", enabled: false, rules: [] },
  { match: "GS칼텍스", name: "GS칼텍스", enabled: false, rules: [] },
  { match: "한국도로공사", name: "한국도로공사", enabled: false, rules: [] },
  { match: "IBK", name: "IBK기업은행", enabled: false, rules: [] },
  { match: "SOOP", name: "SOOP", enabled: false, rules: [] },
] as const;

export type TicketOpenEvent = {
  /** 티켓 오픈일 YYYY-MM-DD (KST 달력일) */
  date: string;
  time: string;
  label: string;
  opponent: string;
  matchDate: string;
  venue: string;
  teamName: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD 에서 days 일 전 (달력일 기준, 타임존 드리프트 없음) */
export function subtractCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function seoulDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function seoulTimeHm(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function involvesTeam(m: Match, teamKeyword: string): boolean {
  return (m.teamA ?? "").includes(teamKeyword) || (m.teamB ?? "").includes(teamKeyword);
}

export function isTeamHomeVleagueMatch(m: Match, teamKeyword: string): boolean {
  if ((m.category ?? "").trim() !== "브이리그") return false;
  if ((m.homeAway ?? "").trim() !== "홈") return false;
  return involvesTeam(m, teamKeyword);
}

function opponentOf(m: Match, teamKeyword: string): string {
  if ((m.teamA ?? "").includes(teamKeyword)) return (m.teamB ?? "").trim() || "상대";
  if ((m.teamB ?? "").includes(teamKeyword)) return (m.teamA ?? "").trim() || "상대";
  return ((m.teamB || m.teamA) ?? "").trim() || "상대";
}

function findConfig(teamKeyword: string): TeamTicketConfig | undefined {
  return TEAM_TICKET_CONFIGS.find((c) => c.match === teamKeyword || c.name === teamKeyword);
}

export type ComputeTicketOpenOptions = {
  onlyUpcoming?: boolean;
  /** 테스트용. 기본은 현재 시각 */
  now?: Date;
  /** label 필터. 비우면 구단의 모든 규칙 */
  labels?: readonly string[];
};

/**
 * 해당 구단 브이리그 홈경기 × 티켓 규칙 → 오픈 이벤트 목록.
 * onlyUpcoming 이면 이미 지난 오픈(날짜+시각)은 제외.
 */
export function computeTicketOpenEvents(
  matches: readonly Match[],
  teamKeyword: string,
  options: ComputeTicketOpenOptions = {}
): TicketOpenEvent[] {
  const config = findConfig(teamKeyword);
  if (!config?.enabled || config.rules.length === 0) return [];

  const rules =
    options.labels && options.labels.length > 0
      ? config.rules.filter((r) => options.labels!.includes(r.label))
      : [...config.rules];
  if (rules.length === 0) return [];

  const now = options.now ?? new Date();
  const todayKey = seoulDateKey(now);
  const nowHm = seoulTimeHm(now);

  const events: TicketOpenEvent[] = [];
  for (const m of matches) {
    if (!isTeamHomeVleagueMatch(m, config.match)) continue;
    const matchDate = (m.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) continue;

    for (const rule of rules) {
      const openDate = subtractCalendarDays(matchDate, rule.daysBefore);
      if (options.onlyUpcoming) {
        if (openDate < todayKey) continue;
        if (openDate === todayKey && rule.time <= nowHm) continue;
      }
      events.push({
        date: openDate,
        time: rule.time,
        label: rule.label,
        opponent: opponentOf(m, config.match),
        matchDate,
        venue: (m.venue ?? "").trim(),
        teamName: config.name,
      });
    }
  }

  return events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byTime = a.time.localeCompare(b.time);
    if (byTime !== 0) return byTime;
    return a.label.localeCompare(b.label);
  });
}
