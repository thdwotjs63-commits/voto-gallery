import { describe, expect, it } from "vitest";
import {
  buildBoothCompositeFileName,
  buildBoothOriginalFileName,
  formatBoothSequenceLabel,
  listFramesForMode,
  resolveInitialFrame,
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

describe("photo-booth frame visibility", () => {
  const frames = [
    { id: "daein" },
    { id: "daein-2" },
    { id: "baeyuna", boothOnly: true },
  ];
  const ids = (list: { id: string }[]) => list.map((f) => f.id);

  it("hides boothOnly frames in regular mode", () => {
    expect(ids(listFramesForMode(frames, false))).toEqual(["daein", "daein-2"]);
  });

  it("puts boothOnly frames first in booth mode", () => {
    expect(ids(listFramesForMode(frames, true))).toEqual(["baeyuna", "daein", "daein-2"]);
  });

  it("ignores a boothOnly frame requested in regular mode", () => {
    expect(resolveInitialFrame(frames, false, "baeyuna").id).toBe("daein");
  });

  it("honors a visible requested frame", () => {
    expect(resolveInitialFrame(frames, false, "daein-2").id).toBe("daein-2");
  });

  it("defaults to the boothOnly frame in booth mode", () => {
    expect(resolveInitialFrame(frames, true).id).toBe("baeyuna");
  });
});
