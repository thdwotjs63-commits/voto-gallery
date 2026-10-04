import { describe, expect, it } from "vitest";
import {
  countdownAriaLabel,
  formatCountdown,
  isCountdownUrgent,
  splitCountdown,
} from "./countdown";

const DEADLINE = new Date("2026-10-14T22:00:00+09:00").getTime();
const at = (kst: string) => new Date(`${kst}+09:00`).getTime();
const partsAt = (kst: string) => splitCountdown(DEADLINE - at(kst));

describe("splitCountdown", () => {
  it("shows days and a clock when a day or more is left", () => {
    const parts = partsAt("2026-10-04T15:47:27")!;
    expect(formatCountdown(parts)).toBe("10일 06:12:33");
    expect(isCountdownUrgent(parts)).toBe(false);
  });

  it("drops the days and turns urgent under 24 hours", () => {
    const parts = partsAt("2026-10-13T22:00:01")!;
    expect(formatCountdown(parts)).toBe("23:59:59");
    expect(isCountdownUrgent(parts)).toBe(true);
  });

  it("treats exactly 24 hours as not urgent", () => {
    expect(isCountdownUrgent(partsAt("2026-10-13T22:00:00")!)).toBe(false);
  });

  it("rounds partial seconds up so 00:00:00 is never shown", () => {
    expect(formatCountdown(splitCountdown(400)!)).toBe("00:00:01");
  });

  it("is null at and after the deadline", () => {
    expect(partsAt("2026-10-14T22:00:00")).toBeNull();
    expect(partsAt("2026-10-15T00:00:00")).toBeNull();
  });
});

describe("countdownAriaLabel", () => {
  it("changes at most once a minute", () => {
    expect(countdownAriaLabel(partsAt("2026-10-04T15:47:27")!)).toBe("마감까지 10일 6시간 남음");
    expect(countdownAriaLabel(partsAt("2026-10-14T15:47:27")!)).toBe("마감까지 6시간 12분 남음");
    expect(countdownAriaLabel(partsAt("2026-10-14T15:47:59")!)).toBe("마감까지 6시간 12분 남음");
    expect(countdownAriaLabel(partsAt("2026-10-14T21:50:00")!)).toBe("마감까지 10분 남음");
    expect(countdownAriaLabel(partsAt("2026-10-14T21:59:50")!)).toBe("마감까지 1분 미만 남음");
  });
});
