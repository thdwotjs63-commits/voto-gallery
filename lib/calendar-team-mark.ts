import { getCountryFlag, isKoreaTeamName } from "./country-flags";
import { VLEAGUE_TEAMS } from "./vleague-teams";

export type CalendarTeamMark =
  | { kind: "flag"; flag: string; korea: boolean; title: string }
  | { kind: "club"; short: string; color: string; title: string }
  | { kind: "text"; short: string; title: string };

export function hasTeamName(name: string | null | undefined): boolean {
  return (name ?? "").trim().length > 0;
}

/** 양 팀 모두 비어 있는 입출국·이동 등 비대결 일정 */
export function isEventOnlyMatch(m: {
  teamA?: string | null;
  teamB?: string | null;
}): boolean {
  return !hasTeamName(m.teamA) && !hasTeamName(m.teamB);
}

/** 달력 칸용 일정 이름 — 연도 접두 제거 후 앞부분 */
export function shortenEventLabel(tournament: string, maxChars = 10): string {
  const raw = (tournament ?? "").trim();
  if (!raw) return "일정";
  const stripped = raw.replace(/^20\d{2}\s+/, "").trim() || raw;
  if (stripped.length <= maxChars) return stripped;
  return `${stripped.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * 달력 팀 표기: ① V리그 한 글자 → ② 국기 → ③ 팀명 앞 2글자(회색).
 * 구단을 국가보다 먼저 봐 "한국도로공사"가 🇰🇷로 안 새게 한다.
 * 팀명이 비어 있으면 "미정".
 */
export function resolveCalendarTeamMark(teamName: string): CalendarTeamMark {
  const title = (teamName ?? "").trim();
  if (!title) {
    return { kind: "text", short: "미정", title: "" };
  }

  for (const team of VLEAGUE_TEAMS) {
    if (title.includes(team.match)) {
      return { kind: "club", short: team.short, color: team.color, title };
    }
  }

  const flag = getCountryFlag(title);
  if (flag) {
    return {
      kind: "flag",
      flag,
      korea: isKoreaTeamName(title),
      title,
    };
  }

  const compact = title.replace(/\s+/g, "");
  const short = compact.slice(0, 2) || "미정";
  return { kind: "text", short, title };
}
