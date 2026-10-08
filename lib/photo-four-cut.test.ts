import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectFrameCellsFromPixels, mergeRegionsByVerticalOverlap } from "./photo-four-cut";

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

describe("frame PNG photo cells", () => {
  async function cellsOf(file: string) {
    const { data, info } = await sharp(path.join(process.cwd(), "public/frames", file))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      width: info.width,
      cells: detectFrameCellsFromPixels(data, info.width, info.height, info.channels),
    };
  }

  it("finds the four daein cells", async () => {
    const { cells } = await cellsOf("daein.png");
    expect(cells).toEqual([
      { x: 80, y: 80, w: 1042, h: 782 },
      { x: 80, y: 898, w: 1042, h: 782 },
      { x: 80, y: 1720, w: 1042, h: 782 },
      { x: 80, y: 2538, w: 1042, h: 782 },
    ]);
  });

  it.each(["bongchef.png", "bongchef2.png", "ds.png", "unnie.png"])(
    "%s has the same cells as daein (scaled to its size)",
    async (file) => {
      const daein = await cellsOf("daein.png");
      const frame = await cellsOf(file);
      const scale = frame.width / daein.width;
      expect(frame.cells).toHaveLength(4);
      frame.cells.forEach((cell, i) => {
        const expected = daein.cells[i];
        for (const key of ["x", "y", "w", "h"] as const) {
          expect(Math.abs(cell[key] - expected[key] * scale)).toBeLessThanOrEqual(1);
        }
      });
    },
    20_000
  );
});
