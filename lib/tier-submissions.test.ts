import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase-client", () => ({
  isSupabaseConfigured: false,
  supabase: { from: () => ({ upsert: async () => ({ error: null }) }) },
}));

import { buildTierSubmissionPicks } from "./tier-submissions";

describe("buildTierSubmissionPicks", () => {
  it("formats selected players and omits empty teams", () => {
    const picks = buildTierSubmissionPicks({
      현대건설: 3,
      흥국생명: 11,
      SOOP: null,
    });
    expect(picks).toEqual({
      현대건설: "3 김다인",
      흥국생명: "11 김수지",
    });
    expect(picks.SOOP).toBeUndefined();
    expect(picks.정관장).toBeUndefined();
  });

  it("returns empty object when nothing selected", () => {
    expect(buildTierSubmissionPicks({})).toEqual({});
  });
});
