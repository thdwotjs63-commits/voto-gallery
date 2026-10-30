import { describe, expect, it } from "vitest";
import {
  PLAYERS_ROSTER,
  TIER_TEAMS,
  TIER_TEAMS_CORE,
  findRosterPlayer,
  getVisibleTierTeams,
  rosterPlayerLabel,
  rosterPlayerUrl,
} from "./players-roster";
import { chartTitle, tierChartExportScale } from "./tier-chart";

describe("players-roster", () => {
  it("has 7 core teams and optional 원더독스 as 8th", () => {
    expect(TIER_TEAMS_CORE.map((t) => t.id)).toEqual([
      "현대건설",
      "흥국생명",
      "정관장",
      "GS칼텍스",
      "한국도로공사",
      "IBK기업은행",
      "SOOP",
    ]);
    expect(TIER_TEAMS.map((t) => t.id)).toEqual([...TIER_TEAMS_CORE.map((t) => t.id), "원더독스"]);
    expect(getVisibleTierTeams(false)).toHaveLength(7);
    expect(getVisibleTierTeams(true)).toHaveLength(8);
    expect(getVisibleTierTeams(true).at(-1)?.id).toBe("원더독스");
    expect(getVisibleTierTeams(true).at(-1)?.color).toBe("#D55329");

    const coreTotal = TIER_TEAMS_CORE.reduce((n, t) => n + PLAYERS_ROSTER[t.id].length, 0);
    expect(coreTotal).toBe(121);
    expect(PLAYERS_ROSTER["원더독스"]).toHaveLength(17);
  });

  it("parses Hyundai #3 Kim Dain and builds NFC-encoded url", () => {
    const p = findRosterPlayer("현대건설", 3);
    expect(p?.name).toBe("김다인");
    expect(p?.photo.startsWith("3 ")).toBe(true);
    const url = rosterPlayerUrl("현대건설", p!);
    expect(url.startsWith("/players/")).toBe(true);
    expect(url).toContain("%20");
    expect(url).toContain(encodeURIComponent("현대건설".normalize("NFC")));
    expect(url).toContain(encodeURIComponent("3 김다인.webp".normalize("NFC")));
    expect(url).not.toContain("%E1%84%");
    expect(url).not.toContain("%25");
  });

  it("builds NFC jpg url for 원더독스 staff without jersey display", () => {
    const coach = findRosterPlayer("원더독스", 901);
    expect(coach?.name).toBe("감독 김연경");
    expect(coach?.showNo).toBe(false);
    expect(rosterPlayerLabel(coach!)).toBe("감독 김연경");
    expect(coach?.photo.endsWith(".jpg")).toBe(true);

    const url = rosterPlayerUrl("원더독스", coach!);
    expect(url).toContain(encodeURIComponent("원더독스".normalize("NFC")));
    expect(url).toContain(encodeURIComponent("감독 김연경.jpg".normalize("NFC")));
    expect(url.endsWith(".jpg") || url.includes(".jpg")).toBe(true);
    expect(url).not.toContain("%25");

    const inkusi = findRosterPlayer("원더독스", 3);
    expect(rosterPlayerLabel(inkusi!)).toBe("3 인쿠시");
  });
});

describe("tier-chart title", () => {
  it("prefixes KOVO label", () => {
    expect(chartTitle("취향표")).toBe("KOVO 여자배구 취향표");
    expect(chartTitle("취향파괴범")).toBe("KOVO 여자배구 취향파괴범");
  });
});

describe("tier-chart export scale", () => {
  it("keeps export scale between 2 and 3", () => {
    const scale = tierChartExportScale();
    expect(scale).toBeGreaterThanOrEqual(2);
    expect(scale).toBeLessThanOrEqual(3);
  });
});
