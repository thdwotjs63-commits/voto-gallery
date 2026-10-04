import { describe, expect, it } from "vitest";
import {
  birthdayBannerState,
  birthdayCardPill,
  isOnOrBeforeDate,
  seoulDateKey,
} from "./home-notice";

const DEADLINE = new Date("2026-10-14T22:00:00+09:00");
const at = (kst: string) => new Date(`${kst}+09:00`);
const pill = (now: Date, showFrom = "2026-10-04", birthday = "2026-10-15") =>
  birthdayCardPill(now, showFrom, birthday, DEADLINE);

describe("seoulDateKey", () => {
  it("uses Korea time at the day boundary", () => {
    expect(seoulDateKey(new Date("2026-10-04T14:59:59Z"))).toBe("2026-10-04");
    expect(seoulDateKey(new Date("2026-10-04T15:00:00Z"))).toBe("2026-10-05");
  });
});

describe("birthdayCardPill", () => {
  it("is hidden before showFrom", () => {
    expect(pill(at("2026-10-03T23:59:59"))).toBeNull();
  });

  it("counts days until the birthday before the deadline day", () => {
    expect(pill(at("2026-10-04T00:00:00"))).toBe("D-11");
    expect(pill(at("2026-10-13T23:59:59"))).toBe("D-2");
  });

  it("shows the closing time on the deadline day", () => {
    expect(pill(at("2026-10-14T00:00:00"))).toBe("오늘 밤 10시 마감");
    expect(pill(at("2026-10-14T21:59:59"))).toBe("오늘 밤 10시 마감");
  });

  it("is hidden from the deadline on", () => {
    expect(pill(at("2026-10-14T22:00:00"))).toBeNull();
    expect(pill(at("2026-10-15T12:00:00"))).toBeNull();
  });

  it("is hidden when dates are not filled in", () => {
    expect(pill(at("2026-10-10T12:00:00"), "YYYY-MM-DD", "YYYY-MM-DD")).toBeNull();
  });
});

describe("birthdayBannerState", () => {
  const banner = (now: Date) => birthdayBannerState(now, "2026-10-04", "2026-10-15", DEADLINE);

  it("is hidden before showFrom", () => {
    expect(banner(at("2026-10-03T23:59:59"))).toBeNull();
  });

  it("counts down from showFrom until the deadline", () => {
    expect(banner(at("2026-10-04T00:00:00"))).toBe("countdown");
    expect(banner(at("2026-10-14T21:59:59"))).toBe("countdown");
  });

  it("disappears at the deadline on the night before the birthday", () => {
    expect(banner(at("2026-10-14T22:00:00"))).toBeNull();
    expect(banner(at("2026-10-14T23:59:59"))).toBeNull();
  });

  it("celebrates only on the birthday", () => {
    expect(banner(at("2026-10-15T00:00:00"))).toBe("celebrate");
    expect(banner(at("2026-10-15T23:59:59"))).toBe("celebrate");
    expect(banner(at("2026-10-16T00:00:00"))).toBeNull();
  });
});

describe("isOnOrBeforeDate", () => {
  it("includes the end date", () => {
    expect(isOnOrBeforeDate("2026-10-31", "2026-10-31")).toBe(true);
    expect(isOnOrBeforeDate("2026-11-01", "2026-10-31")).toBe(false);
  });
});
