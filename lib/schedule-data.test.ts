import { describe, expect, it } from "vitest";
import {
  getHyundaiStreak,
  getWeeklyMatches,
  type Match,
} from "./schedule-data";

function match(partial: Partial<Match> & Pick<Match, "date" | "teamA" | "teamB">): Match {
  return {
    startTime: "19:00",
    category: "브이리그",
    tournament: "V리그",
    round: "",
    venue: "수원체육관",
    court: "",
    note: "",
    scoreA: "",
    scoreB: "",
    url: "",
    dain: false,
    natl: false,
    homeAway: "",
    ...partial,
  };
}

const kst = (ymd: string) => new Date(`${ymd}T12:00:00+09:00`);

describe("getHyundaiStreak", () => {
  it("returns null when there are no scored Hyundai games", () => {
    expect(getHyundaiStreak([])).toBeNull();
    expect(
      getHyundaiStreak([
        match({ date: "2026-10-20", teamA: "현대건설", teamB: "IBK", scoreA: "0", scoreB: "0" }),
        match({ date: "2026-10-21", teamA: "GS칼텍스", teamB: "흥국생명", scoreA: "3", scoreB: "1" }),
      ])
    ).toBeNull();
  });

  it("counts a winning streak from the most recent game back", () => {
    const rows = [
      match({ date: "2026-10-10", teamA: "현대건설", teamB: "IBK", scoreA: "3", scoreB: "0" }),
      match({ date: "2026-10-15", teamA: "흥국생명", teamB: "현대건설", scoreA: "1", scoreB: "3" }),
      match({ date: "2026-10-20", teamA: "현대건설", teamB: "GS칼텍스", scoreA: "3", scoreB: "2" }),
    ];
    expect(getHyundaiStreak(rows, kst("2026-10-25"))).toEqual({ streak: 3, streakActive: true });
  });

  it("stops the streak at the first recent loss", () => {
    const rows = [
      match({ date: "2026-10-10", teamA: "현대건설", teamB: "IBK", scoreA: "3", scoreB: "0" }),
      match({ date: "2026-10-15", teamA: "현대건설", teamB: "흥국생명", scoreA: "1", scoreB: "3" }),
      match({ date: "2026-10-20", teamA: "현대건설", teamB: "GS칼텍스", scoreA: "3", scoreB: "1" }),
    ];
    expect(getHyundaiStreak(rows, kst("2026-10-25"))).toEqual({ streak: 1, streakActive: true });
  });

  it("marks streakActive false when the latest game is a loss", () => {
    const rows = [
      match({ date: "2026-10-10", teamA: "현대건설", teamB: "IBK", scoreA: "3", scoreB: "0" }),
      match({ date: "2026-10-20", teamA: "현대건설", teamB: "GS칼텍스", scoreA: "0", scoreB: "3" }),
    ];
    expect(getHyundaiStreak(rows, kst("2026-10-25"))).toEqual({ streak: 0, streakActive: false });
  });

  it("ignores games after today when today is provided", () => {
    const rows = [
      match({ date: "2026-10-20", teamA: "현대건설", teamB: "IBK", scoreA: "3", scoreB: "0" }),
      match({ date: "2026-10-28", teamA: "현대건설", teamB: "GS칼텍스", scoreA: "0", scoreB: "3" }),
    ];
    expect(getHyundaiStreak(rows, kst("2026-10-25"))).toEqual({ streak: 1, streakActive: true });
  });
});

describe("getWeeklyMatches", () => {
  // 2026-10-25 = 일요일 → 이번주는 오늘만, 다음주는 10/26(월)~11/01(일)
  const sunday = kst("2026-10-25");

  it("splits Hyundai matches into this week (today~Sun) and next week (Mon~Sun)", () => {
    const rows = [
      match({ date: "2026-10-24", teamA: "현대건설", teamB: "IBK", dain: true }), // 지난 토 — 제외
      match({ date: "2026-10-25", teamA: "현대건설", teamB: "흥국생명", dain: true, startTime: "14:00" }),
      match({ date: "2026-10-28", teamA: "GS칼텍스", teamB: "현대건설", dain: true, startTime: "19:00" }),
      match({ date: "2026-11-01", teamA: "현대건설", teamB: "정관장", dain: true, startTime: "16:00" }),
      match({ date: "2026-11-02", teamA: "현대건설", teamB: "도로공사", dain: true }), // 다다음주 — 제외
      match({ date: "2026-10-28", teamA: "IBK", teamB: "흥국생명" }), // 현대 아님 — 제외
    ];

    const { thisWeek, nextWeek } = getWeeklyMatches(rows, sunday);
    expect(thisWeek.map((m) => m.date)).toEqual(["2026-10-25"]);
    expect(nextWeek.map((m) => m.date)).toEqual(["2026-10-28", "2026-11-01"]);
  });

  it("uses Monday–Sunday week bounds from a mid-week day", () => {
    // 2026-10-28 = 수요일 → 이번주 수~일(28–11/01), 다음주 11/02–11/08
    const wednesday = kst("2026-10-28");
    const rows = [
      match({ date: "2026-10-26", teamA: "현대건설", teamB: "IBK", dain: true }), // 월 — 이번주지만 오늘 이전
      match({ date: "2026-10-30", teamA: "현대건설", teamB: "흥국생명", dain: true }),
      match({ date: "2026-11-01", teamA: "현대건설", teamB: "GS", dain: true }),
      match({ date: "2026-11-03", teamA: "현대건설", teamB: "정관장", dain: true }),
    ];

    const { thisWeek, nextWeek } = getWeeklyMatches(rows, wednesday);
    expect(thisWeek.map((m) => m.date)).toEqual(["2026-10-30", "2026-11-01"]);
    expect(nextWeek.map((m) => m.date)).toEqual(["2026-11-03"]);
  });

  it("includes matches flagged dain even if the team name omits 현대건설", () => {
    const rows = [
      match({ date: "2026-10-25", teamA: "힐스테이트", teamB: "IBK", dain: true }),
    ];
    expect(getWeeklyMatches(rows, sunday).thisWeek).toHaveLength(1);
  });

  it("returns empty lists when there are no Hyundai games", () => {
    expect(getWeeklyMatches([], sunday)).toEqual({ thisWeek: [], nextWeek: [] });
  });
});
