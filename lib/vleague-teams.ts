/** V리그 여자부 구단 — 캘린더 짧은 표기·컬러 */

export type VLeagueTeam = {
  match: string;
  short: string;
  color: string;
};

export const VLEAGUE_TEAMS: readonly VLeagueTeam[] = [
  { match: "현대건설", short: "현", color: "#F7C331" },
  { match: "흥국생명", short: "흥", color: "#E6007E" },
  { match: "정관장", short: "정", color: "#D7152B" },
  { match: "GS칼텍스", short: "름", color: "#418FA5" },
  { match: "한국도로공사", short: "도", color: "#283585" },
  { match: "도로공사", short: "도", color: "#283585" },
  { match: "IBK", short: "통", color: "#4090D2" },
  { match: "SOOP", short: "숲", color: "#0A5FBF" },
  { match: "원더독스", short: "원", color: "#D55329" },
] as const;

export type TeamShort = {
  short: string;
  color: string;
};

/** 흰/밝은 칩 배경 위에서도 읽히는 글자색 */
export function chipTextColor(bgHex: string): string {
  const hex = bgHex.replace("#", "");
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // 상대 휘도 — 노랑(#F7C331) 등 밝은 색은 진한 글씨
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1A1A1A" : "#FFFFFF";
}

export function getTeamShort(teamName: string): TeamShort {
  const name = (teamName ?? "").trim();
  for (const team of VLEAGUE_TEAMS) {
    if (name.includes(team.match)) {
      return { short: team.short, color: team.color };
    }
  }
  const compact = name.replace(/\s+/g, "");
  const fallback = compact.slice(0, 2) || "미정";
  return { short: fallback, color: "#8A8A8A" };
}
