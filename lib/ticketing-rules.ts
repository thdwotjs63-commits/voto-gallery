import type { Match } from "./schedule-data";

/** 예: { daysBefore: 7, time: "11:00", label: "선예매 (힐스/테리)" } */
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
  /** 홈구장 (경기 venue 없을 때 fallback) */
  homeVenue: string;
  rules: readonly TicketRule[];
  enabled: boolean;
};

/** 원정 티켓 계산에 쓰는 상대 구단 일반예매 라벨 */
export const GENERAL_SALE_LABEL = "일반예매";

/** KOVO 여자부 7구단 — 선예매 7일전 / 일반예매 5일전, 시각·등급만 구단별 */
export const TEAM_TICKET_CONFIGS: readonly TeamTicketConfig[] = [
  {
    match: "현대건설",
    name: "현대건설",
    homeVenue: "수원실내체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "11:00", label: "선예매 (힐스/테리)" },
      { daysBefore: 5, time: "11:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    match: "GS칼텍스",
    name: "GS칼텍스",
    homeVenue: "장충체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "15:00", label: "선예매 (골드)" },
      { daysBefore: 5, time: "12:00", label: "선예매 (실버)" },
      { daysBefore: 5, time: "15:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    match: "흥국생명",
    name: "흥국생명",
    homeVenue: "인천 삼산월드체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "14:00", label: "선예매 (퍼플/핑크)" },
      { daysBefore: 7, time: "16:00", label: "선예매권" },
      { daysBefore: 5, time: "14:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    match: "정관장",
    name: "정관장",
    homeVenue: "대전 충무체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "10:00", label: "선예매 (BLACK)" },
      { daysBefore: 7, time: "15:00", label: "선예매 (RED)" },
      { daysBefore: 5, time: "11:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    match: "IBK",
    name: "IBK기업은행",
    homeVenue: "화성종합경기타운 실내체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "11:00", label: "선예매 (SPECIAL/BASIC)" },
      { daysBefore: 5, time: "11:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    match: "SOOP",
    name: "SOOP",
    homeVenue: "SOOP 스타디움",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "12:00", label: "선예매 (스타)" },
      { daysBefore: 7, time: "15:00", label: "선예매 (루키)" },
      { daysBefore: 5, time: "11:00", label: GENERAL_SALE_LABEL },
    ],
  },
  {
    /** "한국도로공사"·"도로공사" 모두 포함 매칭 */
    match: "도로공사",
    name: "한국도로공사",
    homeVenue: "김천실내체육관",
    enabled: true,
    rules: [
      { daysBefore: 7, time: "11:00", label: "선예매 (프레스티지/엘리트)" },
      { daysBefore: 7, time: "13:00", label: "선예매 (라이트)" },
      { daysBefore: 5, time: "11:00", label: GENERAL_SALE_LABEL },
    ],
  },
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
  /** 홈 구단 티켓 vs 원정(상대 일반예매) */
  kind: "home" | "away";
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

export function isTeamAwayVleagueMatch(m: Match, teamKeyword: string): boolean {
  if ((m.category ?? "").trim() !== "브이리그") return false;
  if ((m.homeAway ?? "").trim() !== "원정") return false;
  return involvesTeam(m, teamKeyword);
}

function opponentOf(m: Match, teamKeyword: string): string {
  if ((m.teamA ?? "").includes(teamKeyword)) return (m.teamB ?? "").trim() || "상대";
  if ((m.teamB ?? "").includes(teamKeyword)) return (m.teamA ?? "").trim() || "상대";
  return ((m.teamB || m.teamA) ?? "").trim() || "상대";
}

export function findConfig(teamKeyword: string): TeamTicketConfig | undefined {
  return TEAM_TICKET_CONFIGS.find((c) => c.match === teamKeyword || c.name === teamKeyword);
}

/** 팀명 문자열에서 구단 설정 찾기 (긴 키워드 우선) */
export function findConfigForTeamName(teamName: string): TeamTicketConfig | undefined {
  const n = (teamName ?? "").trim();
  if (!n) return undefined;
  return [...TEAM_TICKET_CONFIGS]
    .sort((a, b) => b.match.length - a.match.length)
    .find((c) => n.includes(c.match));
}

export function getGeneralSaleRule(config: TeamTicketConfig): TicketRule | undefined {
  return config.rules.find((r) => r.label === GENERAL_SALE_LABEL);
}

export type ComputeTicketOpenOptions = {
  onlyUpcoming?: boolean;
  /** 테스트용. 기본은 현재 시각 */
  now?: Date;
  /** 홈경기 규칙 label 필터. 비우면 홈 이벤트 없음(원정만 가능) */
  labels?: readonly string[];
  /** 원정경기 → 상대 구단 일반예매로 추가 */
  includeAway?: boolean;
};

function isUpcoming(
  openDate: string,
  openTime: string,
  todayKey: string,
  nowHm: string
): boolean {
  if (openDate < todayKey) return false;
  if (openDate === todayKey && openTime <= nowHm) return false;
  return true;
}

/**
 * 해당 구단 브이리그 홈(선택 규칙) + 선택 시 원정(상대 일반예매) 티켓 오픈 이벤트.
 * onlyUpcoming 이면 이미 지난 오픈(날짜+시각)은 제외.
 */
export function computeTicketOpenEvents(
  matches: readonly Match[],
  teamKeyword: string,
  options: ComputeTicketOpenOptions = {}
): TicketOpenEvent[] {
  const config = findConfig(teamKeyword);
  if (!config?.enabled || config.rules.length === 0) return [];

  const homeRules =
    options.labels === undefined
      ? [...config.rules]
      : config.rules.filter((r) => options.labels!.includes(r.label));

  const now = options.now ?? new Date();
  const todayKey = seoulDateKey(now);
  const nowHm = seoulTimeHm(now);

  const events: TicketOpenEvent[] = [];

  for (const m of matches) {
    const matchDate = (m.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) continue;

    if (homeRules.length > 0 && isTeamHomeVleagueMatch(m, config.match)) {
      const venue = (m.venue ?? "").trim() || config.homeVenue;
      const opponent = opponentOf(m, config.match);
      for (const rule of homeRules) {
        const openDate = subtractCalendarDays(matchDate, rule.daysBefore);
        if (options.onlyUpcoming && !isUpcoming(openDate, rule.time, todayKey, nowHm)) {
          continue;
        }
        events.push({
          date: openDate,
          time: rule.time,
          label: rule.label,
          opponent,
          matchDate,
          venue,
          teamName: config.name,
          kind: "home",
        });
      }
    }

    if (options.includeAway && isTeamAwayVleagueMatch(m, config.match)) {
      const homeTeamName = opponentOf(m, config.match);
      const homeConfig = findConfigForTeamName(homeTeamName);
      const general = homeConfig ? getGeneralSaleRule(homeConfig) : undefined;
      if (!homeConfig || !general) continue;

      const openDate = subtractCalendarDays(matchDate, general.daysBefore);
      if (options.onlyUpcoming && !isUpcoming(openDate, general.time, todayKey, nowHm)) {
        continue;
      }
      const venue = (m.venue ?? "").trim() || homeConfig.homeVenue;
      events.push({
        date: openDate,
        time: general.time,
        label: "원정 일반예매",
        opponent: homeConfig.name,
        matchDate,
        venue,
        teamName: config.name,
        kind: "away",
      });
    }
  }

  return events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byTime = a.time.localeCompare(b.time);
    if (byTime !== 0) return byTime;
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) return byKind;
    return a.label.localeCompare(b.label);
  });
}
