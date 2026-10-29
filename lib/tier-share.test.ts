import { describe, expect, it } from "vitest";
import {
  applyShareToParticipant,
  buildTierAddPath,
  buildTierAddUrl,
  decodeTierShare,
  encodeTierShare,
  extractTierShareToken,
  nicknamesEqual,
  parseTierShareInput,
  participantFromShare,
} from "./tier-share";
import { createEmptyParticipant } from "./tier-chart";

describe("tier-share encode/decode", () => {
  it("round-trips nickname, fan team, and jersey picks", () => {
    const encoded = encodeTierShare({
      nickname: "다인팬",
      fanTeam: "현대건설",
      picks: {
        현대건설: 3,
        흥국생명: 11,
        정관장: null,
        GS칼텍스: 5,
        한국도로공사: 97,
        IBK기업은행: null,
        SOOP: 10,
      },
    });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.includes("+")).toBe(false);
    expect(encoded.includes("/")).toBe(false);

    const decoded = decodeTierShare(encoded);
    expect(decoded).toEqual({
      nickname: "다인팬",
      fanTeam: "현대건설",
      picks: {
        현대건설: 3,
        흥국생명: 11,
        정관장: null,
        GS칼텍스: 5,
        한국도로공사: 97,
        IBK기업은행: null,
        SOOP: 10,
      },
    });
  });

  it("accepts empty fan team and empty picks", () => {
    const encoded = encodeTierShare({
      nickname: "텅러버",
      fanTeam: null,
      picks: {},
    });
    const decoded = decodeTierShare(encoded);
    expect(decoded?.nickname).toBe("텅러버");
    expect(decoded?.fanTeam).toBeNull();
    expect(decoded?.picks["현대건설"]).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(decodeTierShare("")).toBeNull();
    expect(decodeTierShare("!!!")).toBeNull();
  });

  it("builds /tier?add= path", () => {
    const enc = encodeTierShare({ nickname: "A", fanTeam: "SOOP", picks: { SOOP: 2 } });
    expect(buildTierAddPath(enc)).toBe(`/tier?add=${encodeURIComponent(enc)}`);
  });

  it("parses pasted full URL or raw token", () => {
    const payload = {
      nickname: "붙여넣기팬",
      fanTeam: "IBK기업은행" as const,
      picks: { IBK기업은행: 1, 현대건설: 3 },
    };
    const enc = encodeTierShare(payload);
    const url = buildTierAddUrl("https://daeni.kr", payload);

    expect(extractTierShareToken(url)).toBe(enc);
    expect(extractTierShareToken(enc)).toBe(enc);
    expect(extractTierShareToken(`/tier?add=${encodeURIComponent(enc)}`)).toBe(enc);
    expect(parseTierShareInput(url)).toEqual({
      nickname: "붙여넣기팬",
      fanTeam: "IBK기업은행",
      picks: {
        현대건설: 3,
        흥국생명: null,
        정관장: null,
        GS칼텍스: null,
        한국도로공사: null,
        IBK기업은행: 1,
        SOOP: null,
      },
    });
    expect(parseTierShareInput("not-a-valid-link!!!")).toBeNull();
  });

  it("participantFromShare has no photo and fromLink flag", () => {
    const p = participantFromShare({
      nickname: "링커",
      fanTeam: "IBK기업은행",
      picks: { IBK기업은행: 1 },
    });
    expect(p.profileUrl).toBeNull();
    expect(p.fromLink).toBe(true);
    expect(p.fanTeam).toBe("IBK기업은행");
    expect(p.picks.IBK기업은행).toBe(1);
  });

  it("compares nicknames case-insensitively", () => {
    expect(nicknamesEqual("Daeni", "daeni")).toBe(true);
    expect(nicknamesEqual(" a ", "a")).toBe(true);
    expect(nicknamesEqual("A", "B")).toBe(false);
  });

  it("applyShareToParticipant updates only that row identity fields", () => {
    const row = createEmptyParticipant(2);
    const id = row.id;
    const filled = applyShareToParticipant(
      { ...row, pickPhotos: { 흥국생명: "blob:custom" } },
      {
        nickname: "행전용",
        fanTeam: "흥국생명",
        picks: { 흥국생명: 11 },
      }
    );
    expect(filled.id).toBe(id);
    expect(filled.nickname).toBe("행전용");
    expect(filled.fanTeam).toBe("흥국생명");
    expect(filled.picks.흥국생명).toBe(11);
    expect(filled.profileUrl).toBeNull();
    expect(filled.pickPhotos).toEqual({});
    expect(filled.fromLink).toBe(true);
  });
});
