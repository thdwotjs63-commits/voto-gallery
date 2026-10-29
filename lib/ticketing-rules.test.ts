import { describe, expect, it } from "vitest";
import type { Match } from "./schedule-data";
import {
  TEAM_TICKET_CONFIGS,
  computeTicketOpenEvents,
  findConfigForTeamName,
  getGeneralSaleRule,
  isTeamAwayVleagueMatch,
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
    venue: "",
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

describe("TEAM_TICKET_CONFIGS", () => {
  it("has all 7 clubs enabled with a 일반예매 rule", () => {
    expect(TEAM_TICKET_CONFIGS).toHaveLength(7);
    for (const cfg of TEAM_TICKET_CONFIGS) {
      expect(cfg.enabled).toBe(true);
      expect(getGeneralSaleRule(cfg)).toBeDefined();
      expect(getGeneralSaleRule(cfg)?.daysBefore).toBe(5);
    }
  });
});

describe("subtractCalendarDays", () => {
  it("subtracts 7 and 5 days", () => {
    expect(subtractCalendarDays("2026-11-15", 7)).toBe("2026-11-08");
    expect(subtractCalendarDays("2026-11-15", 5)).toBe("2026-11-10");
  });
});

describe("isTeamHomeVleagueMatch / away", () => {
  it("distinguishes home and away V-league games", () => {
    expect(
      isTeamHomeVleagueMatch(
        match({ date: "2026-11-15", teamA: "현대건설", teamB: "흥국생명", homeAway: "홈" }),
        "현대건설"
      )
    ).toBe(true);
    expect(
      isTeamAwayVleagueMatch(
        match({
          date: "2026-11-15",
          teamA: "흥국생명",
          teamB: "현대건설",
          homeAway: "원정",
        }),
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
  });
});

describe("computeTicketOpenEvents home", () => {
  it("emits Hyundai 힐스/테리 and 일반예매 at 11:00", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-15",
          teamA: "현대건설",
          teamB: "IBK기업은행",
          homeAway: "홈",
          venue: "수원실내체육관",
        }),
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

    expect(events.filter((e) => e.kind === "home")).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-11-08",
      time: "11:00",
      label: "선예매 (힐스/테리)",
      kind: "home",
      venue: "수원실내체육관",
    });
    expect(events[1]).toMatchObject({
      date: "2026-11-10",
      time: "11:00",
      label: "일반예매",
      kind: "home",
    });
  });

  it("uses Jeongkwanjang BLACK/RED times", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-12-10",
          teamA: "정관장",
          teamB: "현대건설",
          homeAway: "홈",
        }),
      ],
      "정관장",
      { onlyUpcoming: false, labels: ["선예매 (BLACK)", "선예매 (RED)"] }
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-12-03",
          time: "10:00",
          label: "선예매 (BLACK)",
        }),
        expect.objectContaining({
          date: "2026-12-03",
          time: "15:00",
          label: "선예매 (RED)",
        }),
      ])
    );
  });

  it("filters past opens when onlyUpcoming is true", () => {
    const events = computeTicketOpenEvents(
      [match({ date: "2026-11-15", teamA: "현대건설", teamB: "정관장", homeAway: "홈" })],
      "현대건설",
      { onlyUpcoming: true, now: kst("2026-11-09", "12:00") }
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ label: "일반예매", date: "2026-11-10" });
  });
});

describe("computeTicketOpenEvents away", () => {
  it("uses the home team's 일반예매 time for away games", () => {
    // 현대건설 원정 @ 흥국생명 → 흥국 일반예매 5일전 14:00
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-20",
          teamA: "흥국생명",
          teamB: "현대건설",
          homeAway: "원정",
          venue: "인천 삼산월드체육관",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "away",
      label: "원정 일반예매",
      date: "2026-11-15",
      time: "14:00",
      opponent: "흥국생명",
      teamName: "현대건설",
      matchDate: "2026-11-20",
      venue: "인천 삼산월드체육관",
    });
  });

  it("uses GS 일반예매 15:00 for away at GS", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-12-01",
          teamA: "GS칼텍스",
          teamB: "현대건설",
          homeAway: "원정",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );
    expect(events[0]).toMatchObject({
      kind: "away",
      date: "2026-11-26",
      time: "15:00",
      opponent: "GS칼텍스",
    });
  });

  it("skips away games when opponent has no ticket rules", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-20",
          teamA: "세르비아",
          teamB: "현대건설",
          homeAway: "원정",
          category: "브이리그",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );
    expect(events).toHaveLength(0);
  });

  it("finds 한국도로공사 config without matching 한국 as country", () => {
    expect(findConfigForTeamName("한국도로공사")?.name).toBe("한국도로공사");
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-22",
          teamA: "한국도로공사",
          teamB: "현대건설",
          homeAway: "원정",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );
    expect(events[0]).toMatchObject({
      time: "11:00",
      opponent: "한국도로공사",
      date: "2026-11-17",
    });
  });
});
