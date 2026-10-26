import { describe, expect, it } from "vitest";
import { resolveCalendarTeamMark } from "./calendar-team-mark";

describe("resolveCalendarTeamMark", () => {
  it("prefers country flag", () => {
    expect(resolveCalendarTeamMark("대한민국")).toMatchObject({
      kind: "flag",
      flag: "🇰🇷",
      korea: true,
    });
    expect(resolveCalendarTeamMark("카자흐스탄")).toMatchObject({
      kind: "flag",
      flag: "🇰🇿",
    });
  });

  it("uses V-league one-letter chip", () => {
    expect(resolveCalendarTeamMark("현대건설")).toMatchObject({
      kind: "club",
      short: "현",
      color: "#F7C331",
    });
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
