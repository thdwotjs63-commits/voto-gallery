import { describe, expect, it } from "vitest";
import {
  buildBoothCompositeFileName,
  buildBoothOriginalFileName,
  formatBoothSequenceLabel,
} from "./photo-booth";

describe("photo-booth filenames", () => {
  const date = new Date("2026-10-02T12:00:00");

  it("formats composite name", () => {
    expect(buildBoothCompositeFileName("daein-2", 12, date)).toBe(
      "daeni-4cut-daein-2-20261002-012.jpg"
    );
  });

  it("formats original slot suffix", () => {
    expect(buildBoothOriginalFileName("daein", 3, 0, date)).toBe(
      "daeni-4cut-daein-20261002-003-1.jpg"
    );
  });

  it("pads sequence label", () => {
    expect(formatBoothSequenceLabel(7)).toBe("007");
  });
});
