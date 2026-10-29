import { describe, expect, it } from "vitest";
import {
  PLAYERS_ROSTER,
  TIER_TEAMS,
  findRosterPlayer,
  rosterPlayerUrl,
} from "./players-roster";
import { chartTitle } from "./tier-chart";

describe("players-roster", () => {
  it("has 7 teams in chart order and 121 players", () => {
    expect(TIER_TEAMS.map((t) => t.id)).toEqual([
      "현대건설",
      "흥국생명",
      "정관장",
      "GS칼텍스",
      "한국도로공사",
      "IBK기업은행",
      "SOOP",
    ]);
    const total = TIER_TEAMS.reduce((n, t) => n + PLAYERS_ROSTER[t.id].length, 0);
    expect(total).toBe(121);
  });

  it("parses Hyundai #3 Kim Dain and builds NFC-encoded url", () => {
    const p = findRosterPlayer("현대건설", 3);
    expect(p?.name).toBe("김다인");
    expect(p?.photo.startsWith("3 ")).toBe(true);
    const url = rosterPlayerUrl("현대건설", p!);
    expect(url.startsWith("/players/")).toBe(true);
    expect(url).toContain("%20");
    // NFC Hangul for 현 (not NFD jamo %E1%84%…)
    expect(url).toContain(encodeURIComponent("현대건설".normalize("NFC")));
    expect(url).toContain(encodeURIComponent("3 김다인.webp".normalize("NFC")));
    expect(url).not.toContain("%E1%84%");
    // single encode only
    expect(url).not.toContain("%25");
  });
});

describe("tier-chart title", () => {
  it("prefixes KOVO label", () => {
    expect(chartTitle("취향표")).toBe("KOVO 여자배구 취향표");
    expect(chartTitle("취향파괴범")).toBe("KOVO 여자배구 취향파괴범");
  });
});
