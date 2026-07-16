import { describe, expect, it } from "vitest";
import {
  compute,
  dayPillar,
  yearPillar,
} from "./saju";

describe("saju manseryeok anchors", () => {
  it("day pillar known anchors", () => {
    expect(dayPillar(1949, 10, 1)).toBe("甲子");
    expect(dayPillar(2000, 1, 1)).toBe("戊午");
    expect(dayPillar(1998, 10, 15)).toBe("乙未");
  });

  it("year pillar around lichun", () => {
    expect(yearPillar(2000, 1, 20)).toBe("己卯"); // 입춘 전 → 전년도
    expect(yearPillar(2000, 2, 10)).toBe("庚辰"); // 입춘 후
  });

  it("near term boundary flag", () => {
    expect(compute(2000, 2, 4).nearTermBoundary).toBe(true);
  });

  it("daeni public profile three pillars without hour", () => {
    const r = compute(1998, 10, 15, null);
    expect(r.pillars).toHaveLength(3);
    expect(dayPillar(1998, 10, 15)).toBe("乙未");
    expect(yearPillar(1998, 10, 15)).toBe("戊寅");
  });
});
