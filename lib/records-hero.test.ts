import { describe, expect, it } from "vitest";
import { KOVO_CAREER_ANCHOR } from "./season-summary";
import {
  getHeroGamesCount,
  getHeroSetSuccessCount,
  getLatestSetSuccessCountTotal,
  usesKovoCareerAnchor,
  type PlayerRecord,
} from "./records-data";

function record(partial: Partial<PlayerRecord>): PlayerRecord {
  return {
    date: "2026-10-17",
    opponent: "흥국생명",
    competition: "V리그",
    round: "1R",
    points: null,
    totalPoints: null,
    attackSuccess: "",
    serveAce: null,
    block: null,
    error: null,
    setSuccess: "",
    setSuccessCount: null,
    setSuccessCountTotal: null,
    setAttempts: null,
    setAvg: null,
    setSuccessRate: "",
    setSuccessRateRaw: "",
    videoUrl: "",
    note: "",
    homeAway: "홈",
    ...partial,
  };
}

describe("usesKovoCareerAnchor", () => {
  it("treats 2026-27 and later as anchor seasons", () => {
    expect(usesKovoCareerAnchor("2026-27")).toBe(true);
    expect(usesKovoCareerAnchor("2027-28")).toBe(true);
    expect(usesKovoCareerAnchor("2025-26")).toBe(false);
    expect(usesKovoCareerAnchor("")).toBe(false);
  });
});

describe("getHeroSetSuccessCount / getHeroGamesCount (2026-27+)", () => {
  it("adds per-game set_success onto KOVO anchor and ignores unplayed rows", () => {
    const latest = [
      record({ date: "2026-10-17", setSuccess: "24", setSuccessCount: 24, points: 2 }),
      record({ date: "2026-10-24", setSuccess: "18", setSuccessCount: 18, points: 1 }),
      // 일정만 깔린 미래 경기 — 합계·경기 수에 미포함
      record({ date: "2026-11-01", setSuccess: "", setSuccessCount: null }),
      // 미출전
      record({
        date: "2026-10-20",
        homeAway: "미출전",
        setSuccess: "99",
        setSuccessCount: 99,
      }),
    ];

    expect(getHeroSetSuccessCount("2026-27", latest)).toBe(
      KOVO_CAREER_ANCHOR.setSuccess + 24 + 18
    );
    expect(getHeroGamesCount("2026-27", latest, latest)).toBe(KOVO_CAREER_ANCHOR.games + 2);
  });

  it("returns bare anchor when 2026-27 has no played games yet", () => {
    const emptySchedule = [
      record({ date: "2026-10-17" }),
      record({ date: "2026-10-24" }),
    ];
    expect(getHeroSetSuccessCount("2026-27", emptySchedule)).toBe(
      KOVO_CAREER_ANCHOR.setSuccess
    );
    expect(getHeroGamesCount("2026-27", emptySchedule, emptySchedule)).toBe(
      KOVO_CAREER_ANCHOR.games
    );
  });
});

describe("legacy seasons keep cumulative set_success_count behavior", () => {
  it("reads last setSuccessCountTotal for 2025-26 sheets", () => {
    const legacy = [
      record({
        date: "2025-10-01",
        setSuccessCount: 20,
        setSuccessCountTotal: 8400,
        points: 1,
      }),
      record({
        date: "2025-10-08",
        setSuccessCount: 22,
        setSuccessCountTotal: 8422,
        points: 2,
      }),
    ];
    expect(usesKovoCareerAnchor("2025-26")).toBe(false);
    expect(getHeroSetSuccessCount("2025-26", legacy)).toBe(8422);
    expect(getLatestSetSuccessCountTotal(legacy)).toBe(8422);
    expect(getHeroGamesCount("2025-26", legacy, legacy)).toBe(2);
  });
});
