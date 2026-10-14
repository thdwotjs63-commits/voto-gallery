import { describe, expect, it, vi } from "vitest";
import type { BookMessage } from "./book-pages";
import { attachBookTranslations } from "./book-translations";

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

describe("attachBookTranslations", () => {
  it("translates only foreign messages and tags their language", async () => {
    const translate = vi.fn(async (text: string) => `번역: ${text}`);
    const [ko, id, en] = await attachBookTranslations(
      [msg("다인 선수 생일 축하해요"), msg("Selamat ulang tahun kak Dain"), msg("Happy birthday captain")],
      translate
    );
    expect(translate).toHaveBeenCalledTimes(2);
    expect(ko.translation).toBeUndefined();
    expect(ko.sourceLang).toBeUndefined();
    expect(id).toMatchObject({ sourceLang: "id", translation: "번역: Selamat ulang tahun kak Dain" });
    expect(en).toMatchObject({ sourceLang: "en", translation: "번역: Happy birthday captain" });
  });

  it("keeps the original when translation fails or throws", async () => {
    const [failed] = await attachBookTranslations([msg("Get well soon, number three")], async () => null);
    expect(failed.sourceLang).toBe("en");
    expect(failed).not.toHaveProperty("translation");

    const [thrown] = await attachBookTranslations([msg("We love you so much Dain")], async () => {
      throw new Error("network");
    });
    expect(thrown.message).toBe("We love you so much Dain");
    expect(thrown).not.toHaveProperty("translation");
  });

  it("reuses a successful translation instead of calling again", async () => {
    const text = "See you on the court again, captain";
    const translate = vi.fn(async () => "다시 코트에서 봐요, 캡틴");
    await attachBookTranslations([msg(text)], translate);
    const [again] = await attachBookTranslations([msg(text)], translate);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(again.translation).toBe("다시 코트에서 봐요, 캡틴");
  });
});
