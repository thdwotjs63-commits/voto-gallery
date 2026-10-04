import { describe, expect, it } from "vitest";
import {
  BIRTHDAY_CLOSED_MESSAGE,
  birthdaySubmitErrorMessage,
  formatSeoulClockLabel,
  formatSeoulDeadlineLabel,
  formatBirthdayMessageDate,
  isBirthdayClosed,
} from "./birthday";

const BEFORE = new Date("2026-10-14T21:59:59+09:00");
const AT = new Date("2026-10-14T22:00:00+09:00");

describe("isBirthdayClosed", () => {
  it("closes exactly at 10/14 22:00 KST", () => {
    expect(isBirthdayClosed(BEFORE)).toBe(false);
    expect(isBirthdayClosed(AT)).toBe(true);
  });
});

describe("deadline labels", () => {
  it("derives the closing text from BIRTHDAY_DEADLINE", () => {
    expect(formatSeoulDeadlineLabel(AT)).toBe("10/14 밤 10시");
    expect(BIRTHDAY_CLOSED_MESSAGE).toContain("(10/14 밤 10시 마감)");
  });

  it("formats other times of day", () => {
    expect(formatSeoulClockLabel(new Date("2026-10-14T09:00:00+09:00"))).toBe("오전 9시");
    expect(formatSeoulClockLabel(new Date("2026-10-14T15:30:00+09:00"))).toBe("오후 3시 30분");
    expect(formatSeoulClockLabel(new Date("2026-10-14T00:00:00+09:00"))).toBe("오전 12시");
  });
});

describe("birthdaySubmitErrorMessage", () => {
  it("treats RLS rejection as closed", () => {
    expect(birthdaySubmitErrorMessage({ code: "42501" }, BEFORE)).toContain("마감");
  });

  it("treats any error after the deadline as closed", () => {
    expect(birthdaySubmitErrorMessage({ message: "boom" }, AT)).toContain("마감");
  });

  it("maps network failures", () => {
    expect(
      birthdaySubmitErrorMessage({ message: "TypeError: Failed to fetch" }, BEFORE)
    ).toContain("인터넷");
  });

  it("falls back to a generic message", () => {
    expect(birthdaySubmitErrorMessage({ message: "boom" }, BEFORE)).toBe(
      "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요"
    );
  });
});

describe("formatBirthdayMessageDate", () => {
  it("formats in KST", () => {
    const label = formatBirthdayMessageDate("2026-10-04T15:00:00Z");
    expect(label).toContain("10");
    expect(label).toContain("5");
    expect(label).toContain("00:00");
  });

  it("returns empty for invalid input", () => {
    expect(formatBirthdayMessageDate("nope")).toBe("");
  });
});
