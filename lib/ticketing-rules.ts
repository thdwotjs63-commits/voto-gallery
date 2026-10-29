import type { Match } from "./schedule-data";
import { VLEAGUE_TEAMS } from "./vleague-teams";

/** 예: { daysBefore: 7, time: "11:00", label: "선예매 (힐스/테리)" } */
export type TicketRule = {
  daysBefore: number;
  time: string;
  label: string;
};

export type TeamTicketConfig = {
  /** UI·선택용 키 (findConfig 매칭) */
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

/** 티켓 오픈 알림 대상 경기일 범위 (2026-27 시즌: 10월~4월) */
export const TICKETING_MATCH_FROM = "2026-10-01";
export const TICKETING_MATCH_TO = "2027-04-30";

function isInTicketingSeason(matchDate: string): boolean {
  return matchDate >= TICKETING_MATCH_FROM && matchDate <= TICKETING_MATCH_TO;
}

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

/**
 * 구단 매칭 키워드 — vleague-teams 부분포함 키워드 + config.match.
 * 긴 키워드 우선(한국도로공사 > 도로공사, GS칼텍스 > GS).
 */
export function matchKeywordsForConfig(config: TeamTicketConfig): string[] {
  const keys = new Set<string>([config.match, config.name]);
  for (const t of VLEAGUE_TEAMS) {
    if (
      t.match === config.match ||
      config.name.includes(t.match) ||
      (config.match === "도로공사" &&
        (t.match === "도로공사" || t.match === "한국도로공사")) ||
      (config.match === "GS칼텍스" && t.match === "GS칼텍스") ||
      (config.match === "SOOP" && t.match === "SOOP") ||
      (config.match === "IBK" && t.match === "IBK")
    ) {
      keys.add(t.match);
    }
  }
  if (config.match === "GS칼텍스") keys.add("GS");
  return [...keys].sort((a, b) => b.length - a.length);
}

export function teamNameMatchesConfig(teamName: string, config: TeamTicketConfig): boolean {
  const n = (teamName ?? "").trim();
  if (!n) return false;
  return matchKeywordsForConfig(config).some((k) => n.includes(k));
}

/** 브이리그 + teamA(홈)에 구단 포함 — homeAway 미사용 */
export function isTeamHomeVleagueMatch(m: Match, config: TeamTicketConfig): boolean {
  if ((m.category ?? "").trim() !== "브이리그") return false;
  return teamNameMatchesConfig(m.teamA ?? "", config);
}

/** 브이리그 + teamB(원정)에 구단 포함 — homeAway 미사용 */
export function isTeamAwayVleagueMatch(m: Match, config: TeamTicketConfig): boolean {
  if ((m.category ?? "").trim() !== "브이리그") return false;
  return teamNameMatchesConfig(m.teamB ?? "", config);
}

export function findConfig(teamKeyword: string): TeamTicketConfig | undefined {
  return TEAM_TICKET_CONFIGS.find((c) => c.match === teamKeyword || c.name === teamKeyword);
}

/** 팀명 문자열에서 구단 설정 찾기 (긴 키워드 우선) */
export function findConfigForTeamName(teamName: string): TeamTicketConfig | undefined {
  const n = (teamName ?? "").trim();
  if (!n) return undefined;
  const ranked = [...TEAM_TICKET_CONFIGS].sort(
    (a, b) => matchKeywordsForConfig(b)[0]!.length - matchKeywordsForConfig(a)[0]!.length
  );
  return ranked.find((c) => teamNameMatchesConfig(n, c));
}

export function getGeneralSaleRule(config: TeamTicketConfig): TicketRule | undefined {
  return config.rules.find((r) => r.label === GENERAL_SALE_LABEL);
}

export type ComputeTicketOpenOptions = {
  /** true면 경기일이 오늘(KST) 이후인 것만. 오픈 시각이 지났어도 경기가 남으면 포함 */
  onlyUpcoming?: boolean;
  /** 테스트용. 기본은 현재 시각 */
  now?: Date;
  /** 홈경기 규칙 label 필터. 비우면 홈 이벤트 없음(원정만 가능) */
  labels?: readonly string[];
  /** 원정경기 → 상대(teamA) 구단 일반예매로 추가 */
  includeAway?: boolean;
};

/**
 * onlyUpcoming: 오픈 시각이 아니라 "경기일"이 오늘 이후인 것만.
 * (개막 직전처럼 오픈은 지났어도 경기가 남으면 목록·ICS에 남긴다)
 */
function isUpcomingMatchDay(matchDate: string, todayKey: string): boolean {
  return matchDate >= todayKey;
}

/**
 * 해당 구단 브이리그 홈(teamA) + 선택 시 원정(teamB→teamA 일반예매) 티켓 오픈.
 * homeAway 필드는 사용하지 않는다(현대건설 전용 값이라 다른 구단 누락됨).
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

  const events: TicketOpenEvent[] = [];

  for (const m of matches) {
    const matchDate = (m.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) continue;
    if (!isInTicketingSeason(matchDate)) continue;
    if (options.onlyUpcoming && !isUpcomingMatchDay(matchDate, todayKey)) continue;

    if (homeRules.length > 0 && isTeamHomeVleagueMatch(m, config)) {
      const venue = (m.venue ?? "").trim() || config.homeVenue;
      const opponent = (m.teamB ?? "").trim() || "상대";
      for (const rule of homeRules) {
        const openDate = subtractCalendarDays(matchDate, rule.daysBefore);
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

    if (options.includeAway && isTeamAwayVleagueMatch(m, config)) {
      const homeTeamName = (m.teamA ?? "").trim();
      const homeConfig = findConfigForTeamName(homeTeamName);
      const general = homeConfig ? getGeneralSaleRule(homeConfig) : undefined;
      if (!homeConfig || !general) continue;

      const openDate = subtractCalendarDays(matchDate, general.daysBefore);
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

/** 미리보기·선택 저장용 — 같은 경기의 티켓 오픈들을 묶음 */
export type TicketMatchGroup = {
  key: string;
  matchDate: string;
  kind: "home" | "away";
  opponent: string;
  teamName: string;
  venue: string;
  events: TicketOpenEvent[];
};

export function ticketMatchGroupKey(ev: Pick<TicketOpenEvent, "matchDate" | "kind" | "opponent" | "teamName">): string {
  return `${ev.matchDate}|${ev.kind}|${ev.opponent}|${ev.teamName}`;
}

/** 경기일 순으로 그룹. 그룹 안 이벤트는 오픈 시각 순 유지 */
export function groupTicketEventsByMatch(
  events: readonly TicketOpenEvent[]
): TicketMatchGroup[] {
  const map = new Map<string, TicketMatchGroup>();
  for (const ev of events) {
    const key = ticketMatchGroupKey(ev);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        matchDate: ev.matchDate,
        kind: ev.kind,
        opponent: ev.opponent,
        teamName: ev.teamName,
        venue: ev.venue,
        events: [],
      };
      map.set(key, group);
    }
    group.events.push(ev);
  }
  return [...map.values()].sort((a, b) => {
    const byMatch = a.matchDate.localeCompare(b.matchDate);
    if (byMatch !== 0) return byMatch;
    return a.kind.localeCompare(b.kind);
  });
}
