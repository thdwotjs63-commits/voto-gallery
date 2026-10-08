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
    { id: "event", boothOnly: true },
    { id: "secret", hidden: true },
  ];
  const ids = (list: { id: string }[]) => list.map((f) => f.id);

  it("hides boothOnly frames in regular mode", () => {
    expect(ids(listFramesForMode(frames, false))).toEqual(["daein", "daein-2"]);
  });

  it("puts boothOnly frames first in booth mode", () => {
    expect(ids(listFramesForMode(frames, true))).toEqual(["event", "daein", "daein-2"]);
  });

  it("ignores a boothOnly frame requested in regular mode", () => {
    expect(resolveInitialFrame(frames, false, "event").id).toBe("daein");
  });

  it("honors a visible requested frame", () => {
    expect(resolveInitialFrame(frames, false, "daein-2").id).toBe("daein-2");
  });

  it("defaults to the boothOnly frame in booth mode", () => {
    expect(resolveInitialFrame(frames, true).id).toBe("event");
  });

  it("defaults to daein in both modes when there is no boothOnly frame", () => {
    const plain = frames.filter((f) => f.id !== "event");
    expect(resolveInitialFrame(plain, false).id).toBe("daein");
    expect(resolveInitialFrame(plain, true).id).toBe("daein");
  });

  it("never lists hidden frames", () => {
    expect(ids(listFramesForMode(frames, false))).not.toContain("secret");
    expect(ids(listFramesForMode(frames, true))).not.toContain("secret");
    expect(resolveInitialFrame(frames, false).id).toBe("daein");
  });

  it("opens a hidden frame only when its id is requested", () => {
    expect(resolveInitialFrame(frames, false, "secret").id).toBe("secret");
    expect(resolveInitialFrame(frames, true, "secret").id).toBe("secret");
    expect(resolveInitialFrame(frames, false, "SECRET").id).toBe("daein");
  });

  it("keeps a hidden boothOnly frame out of regular mode even by id", () => {
    const withEventSecret = [...frames, { id: "event-secret", boothOnly: true, hidden: true }];
    expect(ids(listFramesForMode(withEventSecret, true))).toEqual(["event", "daein", "daein-2"]);
    expect(resolveInitialFrame(withEventSecret, true, "event-secret").id).toBe("event-secret");
    expect(resolveInitialFrame(withEventSecret, false, "event-secret").id).toBe("daein");
  });
});
