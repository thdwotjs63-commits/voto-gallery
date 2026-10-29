import { describe, expect, it } from "vitest";
import type { Match } from "./schedule-data";
import {
  TEAM_TICKET_CONFIGS,
  computeTicketOpenEvents,
  findConfig,
  findConfigForTeamName,
  getGeneralSaleRule,
  isTeamAwayVleagueMatch,
  isTeamHomeVleagueMatch,
  subtractCalendarDays,
  teamNameMatchesConfig,
} from "./ticketing-rules";

/** homeAway 비움 — 티켓팅은 teamA=홈, teamB=원정만 사용 */
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
    dain: false,
    natl: false,
    homeAway: "",
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

describe("teamA/teamB home-away detection (ignores homeAway)", () => {
  const hyundai = findConfig("현대건설")!;
  const heungkuk = findConfig("흥국생명")!;

  it("treats teamA as home even when homeAway is empty or misleading", () => {
    const home = match({
      date: "2026-11-15",
      teamA: "흥국생명",
      teamB: "현대건설",
      homeAway: "",
    });
    expect(isTeamHomeVleagueMatch(home, heungkuk)).toBe(true);
    expect(isTeamAwayVleagueMatch(home, hyundai)).toBe(true);
    expect(isTeamHomeVleagueMatch(home, hyundai)).toBe(false);

    const misleading = match({
      date: "2026-11-15",
      teamA: "흥국생명",
      teamB: "현대건설",
      homeAway: "홈", // 현대건설 기준 필드여도 teamA/B가 우선
    });
    expect(isTeamHomeVleagueMatch(misleading, heungkuk)).toBe(true);
    expect(isTeamAwayVleagueMatch(misleading, hyundai)).toBe(true);
  });

  it("matches name variants via keywords", () => {
    const road = findConfig("도로공사")!;
    expect(teamNameMatchesConfig("한국도로공사", road)).toBe(true);
    expect(teamNameMatchesConfig("도로공사", road)).toBe(true);
    expect(teamNameMatchesConfig("SOOP SOOPers", findConfig("SOOP")!)).toBe(true);
    expect(teamNameMatchesConfig("IBK기업은행", findConfig("IBK")!)).toBe(true);
    expect(findConfigForTeamName("한국도로공사")?.name).toBe("한국도로공사");
  });
});

describe("computeTicketOpenEvents home for any club", () => {
  it("emits Hyundai home opens from teamA", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-15",
          teamA: "현대건설",
          teamB: "IBK기업은행",
          venue: "수원실내체육관",
        }),
        match({
          date: "2026-11-20",
          teamA: "흥국생명",
          teamB: "현대건설",
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
  });

  it("emits Heungkuk home opens at 삼산 (not Hyundai-only)", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-22",
          teamA: "흥국생명",
          teamB: "정관장",
          venue: "인천 삼산월드체육관",
          homeAway: "",
        }),
        match({
          date: "2026-11-15",
          teamA: "현대건설",
          teamB: "흥국생명",
        }),
      ],
      "흥국생명",
      { onlyUpcoming: false }
    );

    const home = events.filter((e) => e.kind === "home");
    expect(home.length).toBeGreaterThanOrEqual(3);
    expect(home).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "선예매 (퍼플/핑크)",
          time: "14:00",
          date: "2026-11-15",
          venue: "인천 삼산월드체육관",
          opponent: "정관장",
        }),
        expect.objectContaining({
          label: "선예매권",
          time: "16:00",
          date: "2026-11-15",
        }),
        expect.objectContaining({
          label: "일반예매",
          time: "14:00",
          date: "2026-11-17",
        }),
      ])
    );
  });

  it("emits Korea Expressway home opens in Gimcheon", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-08",
          teamA: "한국도로공사",
          teamB: "흥국생명",
          venue: "김천실내체육관",
        }),
        match({
          date: "2026-11-20",
          teamA: "도로공사",
          teamB: "현대건설",
          venue: "김천실내체육관",
        }),
      ],
      "도로공사",
      { onlyUpcoming: false, labels: ["일반예매"] }
    );

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.matchDate).sort()).toEqual(["2026-11-08", "2026-11-20"]);
    expect(events.every((e) => e.kind === "home" && e.time === "11:00")).toBe(true);
    expect(events.every((e) => e.venue === "김천실내체육관")).toBe(true);
  });

  it("keeps opens for upcoming match days even if open time already passed", () => {
    // 10/31 경기 → 오픈은 10/24·10/26이지만, 오늘이 10/29면 경기일이 남아 목록에 포함
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-10-31",
          teamA: "GS칼텍스",
          teamB: "한국도로공사",
          venue: "서울장충체육관",
        }),
      ],
      "GS칼텍스",
      { onlyUpcoming: true, now: kst("2026-10-29", "12:00") }
    );
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.every((e) => e.matchDate === "2026-10-31")).toBe(true);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "선예매 (골드)", date: "2026-10-24", time: "15:00" }),
        expect.objectContaining({ label: "선예매 (실버)", date: "2026-10-26", time: "12:00" }),
        expect.objectContaining({ label: "일반예매", date: "2026-10-26", time: "15:00" }),
      ])
    );
  });

  it("drops events when the match day itself is past", () => {
    const events = computeTicketOpenEvents(
      [match({ date: "2026-10-20", teamA: "현대건설", teamB: "정관장" })],
      "현대건설",
      { onlyUpcoming: true, now: kst("2026-10-29", "12:00") }
    );
    expect(events).toHaveLength(0);
  });
});

describe("computeTicketOpenEvents away via teamB", () => {
  it("uses the home team's (teamA) 일반예매 time", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-20",
          teamA: "흥국생명",
          teamB: "현대건설",
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
    });
  });

  it("uses GS 일반예매 15:00 when Heungkuk visits GS", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-12-01",
          teamA: "GS칼텍스",
          teamB: "흥국생명",
        }),
      ],
      "흥국생명",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );
    expect(events[0]).toMatchObject({
      kind: "away",
      date: "2026-11-26",
      time: "15:00",
      opponent: "GS칼텍스",
      teamName: "흥국생명",
    });
  });

  it("skips away when teamA is not a V-league club with rules", () => {
    const events = computeTicketOpenEvents(
      [
        match({
          date: "2026-11-20",
          teamA: "세르비아",
          teamB: "현대건설",
        }),
      ],
      "현대건설",
      { onlyUpcoming: false, labels: [], includeAway: true }
    );
    expect(events).toHaveLength(0);
  });
});
