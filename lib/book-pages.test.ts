import { describe, expect, it } from "vitest";
import {
  buildBookPages,
  formatBookDate,
  isBookMessageId,
  paginateBookMessages,
  selectVisibleBookMessages,
  type BookMessage,
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
    const list = [msg("a"), msg("b"), msg("c")];
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
