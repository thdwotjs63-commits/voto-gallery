import { describe, expect, it } from "vitest";
import {
  SCORE,
  TITLES,
  countSharedSinsal,
  dayStemPoints,
  finalizeScore,
  scoreBranch,
  scoreElement,
  scoreSinsal,
  titleForScore,
} from "./saju-compat";
import type { TenGodName } from "./saju";

describe("SCORE caps", () => {
  it("sinsal: 4 shared still caps at MAX 15", () => {
    expect(scoreSinsal(4)).toBe(SCORE.SINSAL.MAX);
    expect(scoreSinsal(4)).toBe(15);
    expect(4 * SCORE.SINSAL.perShared).toBeGreaterThan(SCORE.SINSAL.MAX);
  });

  it("sinsal: countSharedSinsal counts kinds once", () => {
    const n = countSharedSinsal([
      "백호살(乙未)",
      "백호살·괴강(壬戌)",
      "귀문관살(寅未)",
      "화개살(戌)",
      "괴강(庚戌)",
    ]);
    expect(n).toBe(4);
    expect(scoreSinsal(n)).toBe(15);
  });

  it("element: fire+metal+daeniFill raw 22 stays at MAX", () => {
    const { points } = scoreElement({ 목: 0, 화: 2, 토: 0, 금: 1, 수: 0 });
    // fills fire 8 + metal 8 + daeni fills 목/토/수 missing → 6 = 22
    expect(points).toBe(SCORE.ELEMENT.MAX);
  });

  it("element: cannot exceed MAX even if logic stacked", () => {
    expect(SCORE.ELEMENT.fillsDaeniFire + SCORE.ELEMENT.fillsDaeniMetal + SCORE.ELEMENT.daeniFillsVisitor).toBe(
      SCORE.ELEMENT.MAX
    );
  });

  it("branch: all flags sum 27 but capped at MAX 20", () => {
    const raw =
      SCORE.BRANCH.yukhap +
      SCORE.BRANCH.banhap +
      SCORE.BRANCH.wonjinGwimun +
      SCORE.BRANCH.chung;
    expect(raw).toBe(27);
    expect(
      scoreBranch({ yukhap: true, banhap: true, wonjinGwimun: true, chung: true })
    ).toBe(SCORE.BRANCH.MAX);
  });

  it("finalizeScore caps at 100", () => {
    expect(
      finalizeScore({
        element: SCORE.ELEMENT.MAX,
        branch: SCORE.BRANCH.MAX,
        dayStem: SCORE.DAY_STEM.jeonginSiksin,
        sinsal: SCORE.SINSAL.MAX,
      })
    ).toBe(100);
  });
});

describe("titleForScore boundaries", () => {
  it("maps boundary scores to TITLES", () => {
    expect(titleForScore(90)).toBe("사주에 새겨진 팬");
    expect(titleForScore(89)).toBe("사주가 밀어주는 팬");
    expect(titleForScore(70)).toBe("사주가 밀어주는 팬");
    expect(titleForScore(69)).toBe("매 경기 진심인 팬");
    expect(titleForScore(50)).toBe("매 경기 진심인 팬");
    expect(titleForScore(49)).toBe("서서히 스며드는 팬");
    expect(titleForScore(30)).toBe("서서히 스며드는 팬");
    expect(titleForScore(29)).toBe("이제 막 도착한 팬");
    expect(titleForScore(0)).toBe("이제 막 도착한 팬");
  });

  it("TITLES constant matches expected copy", () => {
    expect(TITLES.map((t) => t.title)).toEqual([
      "사주에 새겨진 팬",
      "사주가 밀어주는 팬",
      "매 경기 진심인 팬",
      "서서히 스며드는 팬",
      "이제 막 도착한 팬",
    ]);
  });
});

describe("day stem points", () => {
  it("maps ten gods to SCORE.DAY_STEM buckets", () => {
    expect(dayStemPoints("정인")).toBe(10);
    expect(dayStemPoints("식신")).toBe(10);
    expect(dayStemPoints("편인")).toBe(8);
    expect(dayStemPoints("상관")).toBe(8);
    expect(dayStemPoints("정재" as TenGodName)).toBe(6);
    expect(dayStemPoints("편관")).toBe(6);
    expect(dayStemPoints("비견")).toBe(4);
    expect(dayStemPoints("겁재")).toBe(4);
  });
});
