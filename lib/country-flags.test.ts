import { describe, expect, it } from "vitest";
import {
  getCountryDisplay,
  getCountryFlag,
  isKoreaTeamName,
} from "./country-flags";

describe("getCountryFlag", () => {
  it("maps known countries", () => {
    expect(getCountryFlag("대한민국")).toBe("🇰🇷");
    expect(getCountryFlag("한국 여자배구")).toBe("🇰🇷");
    expect(getCountryFlag("일본")).toBe("🇯🇵");
    expect(getCountryFlag("중국")).toBe("🇨🇳");
    expect(getCountryFlag("대만")).toBe("🇹🇼");
    expect(getCountryFlag("카자흐스탄")).toBe("🇰🇿");
  });

  it("prefers longer names over shorter ones", () => {
    expect(getCountryFlag("중국 홍콩")).toBe("🇭🇰");
    expect(getCountryFlag("홍콩")).toBe("🇭🇰");
    expect(getCountryFlag("인도네시아")).toBe("🇮🇩");
    expect(getCountryFlag("인도")).toBe("🇮🇳");
  });

  it("returns null when unknown", () => {
    expect(getCountryFlag("세르비아")).toBeNull();
    expect(getCountryFlag("")).toBeNull();
  });
});

describe("getCountryDisplay", () => {
  it("provides short fallback without question mark", () => {
    expect(getCountryDisplay("세르비아")).toEqual({ flag: null, short: "세르" });
    expect(getCountryDisplay("일본")).toEqual({ flag: "🇯🇵", short: "일본" });
    expect(getCountryDisplay("")).toEqual({ flag: null, short: "미정" });
  });
});

describe("isKoreaTeamName", () => {
  it("detects Korea labels", () => {
    expect(isKoreaTeamName("대한민국")).toBe(true);
    expect(isKoreaTeamName("한국")).toBe(true);
    expect(isKoreaTeamName("일본")).toBe(false);
  });
});
