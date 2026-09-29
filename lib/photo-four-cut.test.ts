import { describe, expect, it } from "vitest";
import { mergeRegionsByVerticalOverlap } from "./photo-four-cut";

type R = {
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
  touchesEdge: boolean;
};

function r(x: number, y: number, w: number, h: number, area?: number): R {
  return { x, y, w, h, area: area ?? w * h, touchesEdge: false };
}

describe("mergeRegionsByVerticalOverlap", () => {
  it("merges left/right split with strong y overlap (daein-2 style)", () => {
    const left = r(81, 81, 442, 474, 200_000);
    const right = r(401, 81, 720, 780, 400_000);
    const merged = mergeRegionsByVerticalOverlap([left, right]);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBe(81);
    expect(merged[0].y).toBe(81);
    expect(merged[0].w).toBe(401 + 720 - 81);
    expect(merged[0].h).toBe(780);
  });

  it("does not merge stacked rows with little y overlap", () => {
    const top = r(40, 40, 521, 391);
    const bottom = r(40, 500, 521, 391);
    const merged = mergeRegionsByVerticalOverlap([top, bottom]);
    expect(merged).toHaveLength(2);
  });
});
