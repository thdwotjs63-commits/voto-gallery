import { getCountryFlag, isKoreaTeamName } from "./country-flags";
import { VLEAGUE_TEAMS } from "./vleague-teams";

export type CalendarTeamMark =
  | { kind: "flag"; flag: string; korea: boolean; title: string }
  | { kind: "club"; short: string; color: string; title: string }
  | { kind: "text"; short: string; title: string };

/**
 * 달력 팀 표기: ① 국기 → ② V리그 한 글자 → ③ 팀명 앞 2글자(회색).
 * 팀명이 비어 있으면 "미정".
 */
export function resolveCalendarTeamMark(teamName: string): CalendarTeamMark {
  const title = (teamName ?? "").trim();
  if (!title) {
    return { kind: "text", short: "미정", title: "" };
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

  for (const team of VLEAGUE_TEAMS) {
    if (title.includes(team.match)) {
      return { kind: "club", short: team.short, color: team.color, title };
    }
  }

  const compact = title.replace(/\s+/g, "");
  const short = compact.slice(0, 2) || "미정";
  return { kind: "text", short, title };
}
