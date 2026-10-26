import { describe, expect, it } from "vitest";
import { chipTextColor, getTeamShort } from "./vleague-teams";

describe("getTeamShort", () => {
  it("matches V-league club keywords", () => {
    expect(getTeamShort("현대건설")).toEqual({ short: "현", color: "#F7C331" });
    expect(getTeamShort("흥국생명")).toEqual({ short: "흥", color: "#E6007E" });
    expect(getTeamShort("정관장 레드스파크스")).toEqual({ short: "정", color: "#D7152B" });
    expect(getTeamShort("GS칼텍스")).toEqual({ short: "름", color: "#418FA5" });
    expect(getTeamShort("한국도로공사")).toEqual({ short: "도", color: "#283585" });
    expect(getTeamShort("IBK기업은행")).toEqual({ short: "통", color: "#4090D2" });
    expect(getTeamShort("SOOP SOOPers")).toEqual({ short: "숲", color: "#0A5FBF" });
  });

  it("falls back to first two characters with gray", () => {
    expect(getTeamShort("대한민국")).toEqual({ short: "대한", color: "#8A8A8A" });
    expect(getTeamShort("수원특례시청")).toEqual({ short: "수원", color: "#8A8A8A" });
    expect(getTeamShort("A")).toEqual({ short: "A", color: "#8A8A8A" });
    expect(getTeamShort("")).toEqual({ short: "미정", color: "#8A8A8A" });
  });
});

describe("chipTextColor", () => {
  it("uses dark text on hyundai yellow and white on dark blues", () => {
    expect(chipTextColor("#F7C331")).toBe("#1A1A1A");
    expect(chipTextColor("#0A5FBF")).toBe("#FFFFFF");
    expect(chipTextColor("#283585")).toBe("#FFFFFF");
  });
});
