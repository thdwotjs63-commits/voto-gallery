import { describe, expect, it } from "vitest";
import {
  seasonOpeningBannerLabel,
  seasonOpeningDaysLeft,
  SEASON_OPENING_DATE_KEY,
} from "./season-opening";

const kst = (ymd: string) => new Date(`${ymd}T12:00:00+09:00`);

describe("seasonOpeningDaysLeft", () => {
  it("returns days until opening before the day", () => {
    expect(seasonOpeningDaysLeft(kst("2026-10-25"), SEASON_OPENING_DATE_KEY)).toBe(6);
  });

  it("returns 0 on opening day", () => {
    expect(seasonOpeningDaysLeft(kst("2026-10-31"), SEASON_OPENING_DATE_KEY)).toBe(0);
  });

  it("returns null after opening", () => {
    expect(seasonOpeningDaysLeft(kst("2026-11-01"), SEASON_OPENING_DATE_KEY)).toBeNull();
  });
});

describe("seasonOpeningBannerLabel", () => {
  it("uses D-n before opening and a special label on the day", () => {
    expect(seasonOpeningBannerLabel(6)).toBe("🏐 2025-26 V-리그 개막 D-6");
    expect(seasonOpeningBannerLabel(0)).toBe("🏐 오늘 V-리그 개막!");
  });
});
