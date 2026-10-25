import { describe, expect, it } from "vitest";
import type { Match } from "./schedule-data";
import { computeVLeagueStandings, formatSetRatio, vLeagueMatchPoints } from "./standings";

function match(
  partial: Partial<Match> & Pick<Match, "teamA" | "teamB" | "scoreA" | "scoreB">
): Match {
  return {
    date: "2026-11-01",
    startTime: "19:00",
    category: "브이리그",
    tournament: "V리그 정규시즌",
    round: "",
    venue: "",
    court: "",
    note: "",
    url: "",
    dain: false,
    natl: false,
    homeAway: "",
    ...partial,
  };
}

describe("vLeagueMatchPoints", () => {
  it("awards 3 / 0 for 3-0 and 3-1", () => {
    expect(vLeagueMatchPoints(3, 0)).toBe(3);
    expect(vLeagueMatchPoints(0, 3)).toBe(0);
    expect(vLeagueMatchPoints(3, 1)).toBe(3);
    expect(vLeagueMatchPoints(1, 3)).toBe(0);
  });

  it("awards 2 / 1 for 3-2", () => {
    expect(vLeagueMatchPoints(3, 2)).toBe(2);
    expect(vLeagueMatchPoints(2, 3)).toBe(1);
  });
});

describe("computeVLeagueStandings", () => {
  it("returns an empty list when no regular-season games are finished", () => {
    expect(computeVLeagueStandings([])).toEqual([]);
    expect(
      computeVLeagueStandings([
        match({ teamA: "현대건설", teamB: "IBK기업은행", scoreA: "", scoreB: "" }),
        match({ teamA: "현대건설", teamB: "IBK기업은행", scoreA: "0", scoreB: "0" }),
        match({
          teamA: "현대건설",
          teamB: "IBK기업은행",
          scoreA: "3",
          scoreB: "0",
          tournament: "2026 여수·NH농협컵",
        }),
        match({
          teamA: "대한민국",
          teamB: "일본",
          scoreA: "3",
          scoreB: "1",
          category: "국제경기",
        }),
      ])
    ).toEqual([]);
  });

  it("applies every V-League point rule across 3-0, 3-1, 3-2, 2-3, 1-3, 0-3", () => {
    const rows = computeVLeagueStandings([
      match({ date: "2026-11-01", teamA: "현대건설", teamB: "IBK기업은행", scoreA: "3", scoreB: "0" }),
      match({ date: "2026-11-02", teamA: "현대건설", teamB: "흥국생명", scoreA: "3", scoreB: "1" }),
      match({ date: "2026-11-03", teamA: "현대건설", teamB: "GS칼텍스", scoreA: "3", scoreB: "2" }),
      match({ date: "2026-11-04", teamA: "현대건설", teamB: "정관장", scoreA: "2", scoreB: "3" }),
      match({ date: "2026-11-05", teamA: "현대건설", teamB: "한국도로공사", scoreA: "1", scoreB: "3" }),
      match({ date: "2026-11-06", teamA: "현대건설", teamB: "SOOP SOOPers", scoreA: "0", scoreB: "3" }),
    ]);

    const hyundai = rows.find((r) => r.team === "현대건설")!;
    expect(hyundai).toMatchObject({
      played: 6,
      wins: 3,
      losses: 3,
      // 3+3+2+1+0+0
      points: 9,
      setsWon: 3 + 3 + 3 + 2 + 1 + 0,
      setsLost: 0 + 1 + 2 + 3 + 3 + 3,
    });
    expect(hyundai.setRatio).toBeCloseTo(hyundai.setsWon / hyundai.setsLost);

    expect(rows.find((r) => r.team === "IBK기업은행")).toMatchObject({ points: 0, wins: 0, losses: 1 });
    expect(rows.find((r) => r.team === "정관장")).toMatchObject({ points: 2, wins: 1, losses: 0 });
    expect(rows.find((r) => r.team === "한국도로공사")).toMatchObject({ points: 3, wins: 1, losses: 0 });
  });

  it("ranks by points, then wins, then set ratio, then team name", () => {
    // A: 3pts 1승, set 3-0 ratio ∞
    // B: 3pts 1승, set 3-1 ratio 3
    // C: 2pts 1승 (3-2)
    // D: 3pts 1승, set 3-0 — same as A → 이름순 (가나다: A팀 vs B팀은 team name)
    const rows = computeVLeagueStandings([
      match({ teamA: "팀비", teamB: "상대1", scoreA: "3", scoreB: "1" }),
      match({ teamA: "팀에이", teamB: "상대2", scoreA: "3", scoreB: "0" }),
      match({ teamA: "팀씨", teamB: "상대3", scoreA: "3", scoreB: "2" }),
      match({ teamA: "팀디", teamB: "상대4", scoreA: "3", scoreB: "0" }),
    ]);

    // 3점대: 팀에이(∞), 팀디(∞) → 이름순 팀디? "팀디" vs "팀에이" — localeCompare ko
    // Actually 팀에이 and 팀디 both ∞ ratio, same points/wins → name sort
    const top = rows.filter((r) => r.points === 3 && r.wins === 1 && r.setsLost === 0);
    expect(top.map((r) => r.team).sort((a, b) => a.localeCompare(b, "ko"))).toEqual(
      top.map((r) => r.team)
    );

    expect(rows[0].points).toBeGreaterThanOrEqual(rows[1].points);
    const teamC = rows.find((r) => r.team === "팀씨")!;
    expect(teamC.points).toBe(2);
    expect(teamC.rank).toBeGreaterThan(rows.find((r) => r.team === "팀비")!.rank);
  });

  it("breaks a points tie using set ratio", () => {
    const rows = computeVLeagueStandings([
      match({ teamA: "강한팀", teamB: "약한팀", scoreA: "3", scoreB: "0" }), // ratio ∞, 3pts
      match({ teamA: "보통팀", teamB: "약한팀2", scoreA: "3", scoreB: "2" }), // ratio 1.5, 2pts — different points
    ]);
    // Better tie case: both 3 points
    const tied = computeVLeagueStandings([
      match({ teamA: "세트좋은팀", teamB: "상대A", scoreA: "3", scoreB: "0" }),
      match({ teamA: "세트아쉬운팀", teamB: "상대B", scoreA: "3", scoreB: "1" }),
    ]);
    expect(tied[0].team).toBe("세트좋은팀");
    expect(tied[1].team).toBe("세트아쉬운팀");
    expect(tied[0].setRatio).toBeGreaterThan(tied[1].setRatio);
    expect(rows[0].team).toBe("강한팀");
  });

  it("formats set ratio for display", () => {
    expect(formatSetRatio(Number.POSITIVE_INFINITY)).toBe("∞");
    expect(formatSetRatio(1.5)).toBe("1.500");
    expect(formatSetRatio(0)).toBe("0.000");
  });
});
