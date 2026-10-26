import { describe, expect, it } from "vitest";
import {
  isEventOnlyMatch,
  resolveCalendarTeamMark,
  shortenEventLabel,
} from "./calendar-team-mark";

describe("resolveCalendarTeamMark", () => {
  it("prefers V-league club over country substring", () => {
    expect(resolveCalendarTeamMark("한국도로공사")).toMatchObject({
      kind: "club",
      short: "도",
      color: "#283585",
    });
    expect(resolveCalendarTeamMark("현대건설")).toMatchObject({
      kind: "club",
      short: "현",
      color: "#F7C331",
    });
    // 한국도로공사 vs 현대건설 → 도 vs 현
    expect(resolveCalendarTeamMark("한국도로공사").kind).toBe("club");
    expect(resolveCalendarTeamMark("한국도로공사")).toMatchObject({ short: "도" });
    expect(resolveCalendarTeamMark("현대건설")).toMatchObject({ short: "현" });
  });

  it("uses country flag after clubs", () => {
    expect(resolveCalendarTeamMark("대한민국")).toMatchObject({
      kind: "flag",
      flag: "🇰🇷",
      korea: true,
    });
    expect(resolveCalendarTeamMark("한국")).toMatchObject({
      kind: "flag",
      flag: "🇰🇷",
      korea: true,
    });
    expect(resolveCalendarTeamMark("카자흐스탄")).toMatchObject({
      kind: "flag",
      flag: "🇰🇿",
    });
  });

  it("does not treat 한국도로공사 as Korea flag", () => {
    const mark = resolveCalendarTeamMark("한국도로공사");
    expect(mark.kind).not.toBe("flag");
    expect(mark).toMatchObject({ kind: "club", short: "도" });
  });

  it("uses V-league one-letter chip", () => {
    expect(resolveCalendarTeamMark("IBK기업은행")).toMatchObject({
      kind: "club",
      short: "통",
    });
  });

  it("falls back to first two characters, not question mark", () => {
    expect(resolveCalendarTeamMark("수원특례시청")).toEqual({
      kind: "text",
      short: "수원",
      title: "수원특례시청",
    });
    expect(resolveCalendarTeamMark("포항시체육회")).toEqual({
      kind: "text",
      short: "포항",
      title: "포항시체육회",
    });
    expect(resolveCalendarTeamMark("  강 남  ")).toEqual({
      kind: "text",
      short: "강남",
      title: "강 남",
    });
  });

  it("uses 미정 only when name is empty", () => {
    expect(resolveCalendarTeamMark("")).toEqual({
      kind: "text",
      short: "미정",
      title: "",
    });
    expect(resolveCalendarTeamMark("   ")).toEqual({
      kind: "text",
      short: "미정",
      title: "",
    });
  });
});

describe("isEventOnlyMatch / shortenEventLabel", () => {
  it("detects empty vs empty training / travel rows", () => {
    expect(
      isEventOnlyMatch({
        teamA: "",
        teamB: "",
      })
    ).toBe(true);
    expect(isEventOnlyMatch({ teamA: "현대건설", teamB: "" })).toBe(false);
    expect(isEventOnlyMatch({ teamA: "", teamB: "일본" })).toBe(false);
  });

  it("shortens 전지훈련 입국/출국 labels without 미정 vs 미정", () => {
    expect(shortenEventLabel("2026 여자배구 팀코리아 전지훈련 입국")).toBe(
      "여자배구 팀코리아…"
    );
    expect(shortenEventLabel("2026 여자배구 팀코리아 전지훈련 출국")).toBe(
      "여자배구 팀코리아…"
    );
    expect(shortenEventLabel("")).toBe("일정");
    expect(isEventOnlyMatch({ teamA: "", teamB: "" })).toBe(true);
    expect(shortenEventLabel("2026 여자배구 팀코리아 전지훈련 입국")).not.toMatch(
      /미정/
    );
  });
});
