import { describe, expect, it } from "vitest";
import type { Match } from "./schedule-data";
import {
  computeTicketOpenEvents,
  isTeamHomeVleagueMatch,
  subtractCalendarDays,
} from "./ticketing-rules";

function match(
  partial: Partial<Match> & Pick<Match, "date" | "teamA" | "teamB">
): Match {
  return {
    startTime: "19:00",
    category: "브이리그",
    tournament: "V리그 정규시즌",
    round: "1R",
    venue: "수원체육관",
    court: "",
    note: "",
    scoreA: "",
    scoreB: "",
    url: "",
    dain: true,
    natl: false,
    homeAway: "홈",
    ...partial,
  };
}

const kst = (ymd: string, hm = "12:00") => new Date(`${ymd}T${hm}:00+09:00`);

describe("subtractCalendarDays", () => {
  it("subtracts 7 and 5 days for Hyundai ticketing", () => {
    expect(subtractCalendarDays("2026-11-15", 7)).toBe("2026-11-08");
    expect(subtractCalendarDays("2026-11-15", 5)).toBe("2026-11-10");
  });

  it("crosses month boundaries", () => {
    expect(subtractCalendarDays("2026-11-03", 7)).toBe("2026-10-27");
  });
});

describe("isTeamHomeVleagueMatch", () => {
  it("keeps only V-league home games for the team", () => {
    expect(
      isTeamHomeVleagueMatch(
        match({ date: "2026-11-15", teamA: "현대건설", teamB: "흥국생명", homeAway: "홈" }),
        "현대건설"
      )
    ).toBe(true);
    expect(
      isTeamHomeVleagueMatch(
        match({
          date: "2026-11-15",
          teamA: "흥국생명",
          teamB: "현대건설",
          homeAway: "원정",
        }),
        "현대건설"
      )
    ).toBe(false);
    expect(
      isTeamHomeVleagueMatch(
        match({
          date: "2026-11-15",
          teamA: "현대건설",
          teamB: "일본",
          category: "국제경기",
          homeAway: "홈",
        }),
        "현대건설"
      )
    ).toBe(false);
  });
});

describe("computeTicketOpenEvents", () => {
  it("emits 선예매(7일전) and 일반예매(5일전) at 11:00 for each home match", () => {
    const events = computeTicketOpenEvents(
      [
        match({ date: "2026-11-15", teamA: "현대건설", teamB: "IBK기업은행", homeAway: "홈" }),
        match({
          date: "2026-11-20",
          teamA: "흥국생명",
          teamB: "현대건설",
          homeAway: "원정",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false }
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-11-08",
      time: "11:00",
      label: "선예매(멤버십)",
      opponent: "IBK기업은행",
      matchDate: "2026-11-15",
      venue: "수원체육관",
      teamName: "현대건설",
    });
    expect(events[1]).toMatchObject({
      date: "2026-11-10",
      time: "11:00",
      label: "일반예매",
      opponent: "IBK기업은행",
      matchDate: "2026-11-15",
    });
  });

  it("filters past opens when onlyUpcoming is true", () => {
    const events = computeTicketOpenEvents(
      [match({ date: "2026-11-15", teamA: "현대건설", teamB: "정관장", homeAway: "홈" })],
      "현대건설",
      { onlyUpcoming: true, now: kst("2026-11-09", "12:00") }
    );
    // 선예매 11/08 11:00 지남, 일반예매 11/10 11:00 남음
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ label: "일반예매", date: "2026-11-10" });
  });

  it("can filter by membership labels", () => {
    const events = computeTicketOpenEvents(
      [match({ date: "2026-11-15", teamA: "현대건설", teamB: "숲", homeAway: "홈" })],
      "현대건설",
      { onlyUpcoming: false, labels: ["선예매(멤버십)"] }
    );
    expect(events).toHaveLength(1);
    expect(events[0].label).toBe("선예매(멤버십)");
  });
});
