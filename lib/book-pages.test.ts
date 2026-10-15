import { describe, expect, it } from "vitest";
import {
  buildBookPages,
  findMessagePagesByNickname,
  formatBookDate,
  isBookMessageId,
  paginateBookMessages,
  parseBookPageInput,
  selectVisibleBookMessages,
  type BookMessage,
  type BookPage,
} from "./book-pages";

let seq = 0;
function msg(message: string): BookMessage {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    nickname: `fan${seq}`,
    message,
    created_at: "2026-10-05T03:00:00Z",
  };
}

describe("paginateBookMessages", () => {
  it("pairs two short messages on one page", () => {
    const pages = paginateBookMessages([msg("짧은 축하"), msg("생일 축하해요")]);
    expect(pages.map((p) => p.length)).toEqual([2]);
  });

  it("puts a long message alone", () => {
    const pages = paginateBookMessages([msg("가".repeat(300)), msg("짧음"), msg("짧음")]);
    expect(pages.map((p) => p.length)).toEqual([1, 2]);
  });

  it("does not pair when the total is too long", () => {
    const pages = paginateBookMessages([msg("가".repeat(200)), msg("나".repeat(200))]);
    expect(pages.map((p) => p.length)).toEqual([1, 1]);
  });

  it("counts line breaks as extra length", () => {
    const tall = Array.from({ length: 12 }, () => "축하").join("\n");
    const pages = paginateBookMessages([msg(tall), msg("짧음")]);
    expect(pages.map((p) => p.length)).toEqual([1, 1]);
  });

  it("keeps the original order", () => {
    const list = [msg("a"), msg("b"), msg("c")];
    expect(paginateBookMessages(list).flat().map((m) => m.id)).toEqual(list.map((m) => m.id));
  });
});

describe("buildBookPages", () => {
  it("shows an empty page when there are no messages", () => {
    expect(buildBookPages([]).map((p) => p.kind)).toEqual(["cover", "letter", "empty", "end"]);
  });

  it("wraps message pages with cover, letter and end", () => {
    const pages = buildBookPages([msg("하나")]);
    expect(pages.map((p) => p.kind)).toEqual(["cover", "letter", "messages", "end"]);
    expect(pages.at(-1)).toEqual({ kind: "end", count: 1 });
  });

  it("moves foreign messages behind a foreign-intro page", () => {
    const pages = buildBookPages([
      msg("생일 축하해요"),
      msg("Selamat ulang tahun kak Dain"),
      msg("다인 선수 최고"),
      msg("Happy birthday captain"),
    ]);
    expect(pages.map((p) => p.kind)).toEqual(["cover", "letter", "messages", "foreign-intro", "foreign", "end"]);
    const korean = pages.flatMap((p) => (p.kind === "messages" ? p.items : []));
    const foreign = pages.flatMap((p) => (p.kind === "foreign" ? p.items : []));
    expect(korean.map((m) => m.message)).toEqual(["생일 축하해요", "다인 선수 최고"]);
    expect(foreign.map((m) => m.message)).toEqual(["Selamat ulang tahun kak Dain", "Happy birthday captain"]);
    expect(pages.at(-1)).toEqual({ kind: "end", count: 4 });
  });

  it("has no foreign section when every message is Korean", () => {
    expect(buildBookPages([msg("축하해요")]).map((p) => p.kind)).not.toContain("foreign-intro");
  });

  it("counts the translation when pairing foreign messages", () => {
    const withTranslation = { ...msg("Happy birthday ".repeat(10).trim()), translation: "생일 축하해요 ".repeat(20).trim() };
    const pages = buildBookPages([withTranslation, msg("Love you")]);
    expect(pages.filter((p) => p.kind === "foreign").map((p) => (p.kind === "foreign" ? p.items.length : 0))).toEqual([1, 1]);
  });

  it("handles 100 messages", () => {
    const list = Array.from({ length: 100 }, (_, i) => msg(i % 3 === 0 ? "가".repeat(260) : "축하해요"));
    const pages = buildBookPages(list);
    const items = pages.flatMap((p) => (p.kind === "messages" ? p.items : []));
    expect(items).toHaveLength(100);
    expect(pages.at(-1)).toEqual({ kind: "end", count: 100 });
  });
});

describe("selectVisibleBookMessages", () => {
  it("drops hidden messages and the end page count follows", () => {
    const list = [msg("가"), msg("나"), msg("다")];
    const visible = selectVisibleBookMessages(list, [list[1].id]);
    expect(visible.map((m) => m.id)).toEqual([list[0].id, list[2].id]);
    expect(buildBookPages(visible).at(-1)).toEqual({ kind: "end", count: 2 });
  });

  it("keeps everything when nothing is hidden", () => {
    const list = [msg("a"), msg("b")];
    expect(selectVisibleBookMessages(list, [])).toHaveLength(2);
  });

  it("strips extra fields such as is_public", () => {
    const [row] = selectVisibleBookMessages([{ ...msg("a"), is_public: false } as BookMessage], []);
    expect(Object.keys(row).sort()).toEqual(["created_at", "id", "message", "nickname"]);
  });
});

describe("parseBookPageInput", () => {
  it("turns a 1-based page number into an index", () => {
    expect(parseBookPageInput("1", 10)).toBe(0);
    expect(parseBookPageInput("7", 10)).toBe(6);
  });

  it("clamps out-of-range numbers to the nearest page", () => {
    expect(parseBookPageInput("0", 10)).toBe(0);
    expect(parseBookPageInput("999", 10)).toBe(9);
  });

  it("ignores stray characters and rejects input without digits", () => {
    expect(parseBookPageInput(" 3쪽 ", 10)).toBe(2);
    expect(parseBookPageInput("-4", 10)).toBe(3);
    expect(parseBookPageInput("", 10)).toBeNull();
    expect(parseBookPageInput("abc", 10)).toBeNull();
  });

  it("returns null for an empty book", () => {
    expect(parseBookPageInput("1", 0)).toBeNull();
  });
});

describe("findMessagePagesByNickname", () => {
  function named(nickname: string, message = "생일 축하해요"): BookMessage {
    return { ...msg(message), nickname };
  }

  const pages: BookPage[] = [
    { kind: "cover" },
    { kind: "letter" },
    { kind: "messages", items: [named("배구 사랑"), named("다인팬")] },
    { kind: "messages", items: [named("Dain Lover")] },
    { kind: "foreign-intro" },
    { kind: "foreign", items: [named("dainlover_id", "Selamat ulang tahun")] },
    { kind: "messages", items: [named("다인팬"), named("다인팬")] },
    { kind: "end", count: 6 },
  ];

  it("finds partial matches ignoring case and spaces, in page order", () => {
    expect(findMessagePagesByNickname(pages, "DAIN lover")).toEqual([
      { nickname: "Dain Lover", pageIndex: 3 },
      { nickname: "dainlover_id", pageIndex: 5 },
    ]);
    expect(findMessagePagesByNickname(pages, "배구사랑")).toEqual([{ nickname: "배구 사랑", pageIndex: 2 }]);
  });

  it("lists every page of a repeated nickname but once per page", () => {
    expect(findMessagePagesByNickname(pages, "다인")).toEqual([
      { nickname: "다인팬", pageIndex: 2 },
      { nickname: "다인팬", pageIndex: 6 },
    ]);
  });

  it("returns nothing for a blank or unmatched query", () => {
    expect(findMessagePagesByNickname(pages, "   ")).toEqual([]);
    expect(findMessagePagesByNickname(pages, "없는닉네임")).toEqual([]);
  });

  it("matches Korean typed in decomposed form", () => {
    expect(findMessagePagesByNickname(pages, "다인팬".normalize("NFD"))).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("formats dates in Korea time", () => {
    expect(formatBookDate("2026-10-14T15:30:00Z")).toBe("2026.10.15");
  });

  it("validates message ids", () => {
    expect(isBookMessageId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isBookMessageId("nope")).toBe(false);
    expect(isBookMessageId(1)).toBe(false);
  });
});
