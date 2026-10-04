import { describe, expect, it } from "vitest";
import {
  addMyBirthdayMessage,
  parseBirthdayMessageCounts,
  parseMyBirthdayMessages,
  removeMyBirthdayMessage,
  type MyBirthdayMessage,
} from "./birthday-counts";

describe("parseBirthdayMessageCounts", () => {
  it("reads the single row returned by the RPC", () => {
    expect(parseBirthdayMessageCounts([{ total: 2, public_count: 1, private_count: 1 }])).toEqual({
      total: 2,
      publicCount: 1,
      privateCount: 1,
    });
  });

  it("accepts bigint values sent as strings", () => {
    expect(parseBirthdayMessageCounts({ total: "3", public_count: "1", private_count: "2" })).toEqual(
      { total: 3, publicCount: 1, privateCount: 2 }
    );
  });

  it("keeps only the three numbers", () => {
    const parsed = parseBirthdayMessageCounts([
      { total: 1, public_count: 0, private_count: 1, nickname: "secret", message: "secret" },
    ]);
    expect(Object.keys(parsed ?? {}).sort()).toEqual(["privateCount", "publicCount", "total"]);
  });

  it("rejects missing or broken responses", () => {
    expect(parseBirthdayMessageCounts(null)).toBeNull();
    expect(parseBirthdayMessageCounts([])).toBeNull();
    expect(parseBirthdayMessageCounts([{ total: -1, public_count: 0, private_count: 0 }])).toBeNull();
    expect(parseBirthdayMessageCounts([{ total: 1.5, public_count: 0, private_count: 0 }])).toBeNull();
  });
});

const mine = (localId: string, isPublic = true): MyBirthdayMessage => ({
  localId,
  nickname: "fan",
  message: "생일 축하해요",
  isPublic,
  createdAt: "2026-10-05T03:00:00.000Z",
});

describe("my birthday messages", () => {
  it("ignores broken storage", () => {
    expect(parseMyBirthdayMessages(null)).toEqual([]);
    expect(parseMyBirthdayMessages("{oops")).toEqual([]);
    expect(parseMyBirthdayMessages(JSON.stringify([mine("a"), { localId: 1 }]))).toEqual([mine("a")]);
  });

  it("puts the newest message first and hides by id", () => {
    const list = addMyBirthdayMessage([mine("a")], mine("b", false));
    expect(list.map((m) => m.localId)).toEqual(["b", "a"]);
    expect(removeMyBirthdayMessage(list, "b").map((m) => m.localId)).toEqual(["a"]);
  });
});
