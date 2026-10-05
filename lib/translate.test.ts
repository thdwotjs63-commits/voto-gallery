import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expandSlang,
  guessSourceLanguage,
  isMostlyKorean,
  isUntranslated,
  parseMyMemoryResponse,
  translateToKorean,
} from "./translate";

const ok = (translatedText: string) => ({
  responseData: { translatedText, match: 0.85 },
  quotaFinished: false,
  responseStatus: 200,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("parseMyMemoryResponse", () => {
  it("returns the translated text", () => {
    expect(parseMyMemoryResponse(ok("생일 축하해요 "))).toBe("생일 축하해요");
    expect(parseMyMemoryResponse(ok("다인&#39;s 최고 &amp; 사랑해"))).toBe("다인's 최고 & 사랑해");
  });

  it("treats warnings, quota and missing text as failures", () => {
    expect(parseMyMemoryResponse(ok("QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS"))).toBeNull();
    expect(parseMyMemoryResponse(ok("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"))).toBeNull();
    expect(parseMyMemoryResponse({ ...ok("번역"), quotaFinished: true })).toBeNull();
    expect(parseMyMemoryResponse({ ...ok("번역"), responseStatus: 403 })).toBeNull();
    expect(parseMyMemoryResponse({ responseStatus: 200, responseData: {} })).toBeNull();
    expect(parseMyMemoryResponse(ok("   "))).toBeNull();
    expect(parseMyMemoryResponse(null)).toBeNull();
  });
});

describe("isMostlyKorean", () => {
  it("looks at the share of Hangul letters", () => {
    expect(isMostlyKorean("다인 선수 생일 축하해요!! 🎂")).toBe(true);
    expect(isMostlyKorean("Selamat ulang tahun kak Dain")).toBe(false);
    expect(isMostlyKorean("Happy birthday 다인")).toBe(false);
    expect(isMostlyKorean("다인 happy birthday 생일 축하해")).toBe(true);
    expect(isMostlyKorean("🎉🎉 1015")).toBe(true);
  });
});

describe("expandSlang", () => {
  it("expands birthday, captain and number abbreviations", () => {
    expect(expandSlang("Happy Bday our no 3")).toBe("Happy Birthday our number 3");
    expect(expandSlang("happy b'day / b’day / bdae")).toBe("happy birthday / birthday / birthday");
    expect(expandSlang("my capt kim dain")).toBe("my captain Kim Dain");
    expect(expandSlang("cap, capten, captn, captennnnn!")).toBe("captain, captain, captain, captain!");
    expect(expandSlang("No.3 and no3 and NO 12")).toBe("Number 3 and number 3 and Number 12");
  });

  it("expands chat shorthand only when it stands alone", () => {
    expect(expandSlang("thx u")).toBe("thank you");
    expect(expandSlang("Thank u, thx")).toBe("Thank you, thank you");
    expect(expandSlang("tysm")).toBe("thank you so much");
    expect(expandSlang("TQ, ur the best, u r amazing")).toBe("Thank you, your the best, you are amazing");
    expect(expandSlang("pls plz congrats congratz")).toBe("please please congratulations congratulations");
    expect(expandSlang("your turn, run, true, user, U-20, R&B")).toBe("your turn, run, true, user, U-20, R&B");
  });

  it("writes the player's name the standard way", () => {
    expect(expandSlang("kakak da in.. kim dain, KIM DA IN")).toBe("kakak Dain.. Kim Dain, Kim Dain");
  });

  it("leaves sentences without slang alone", () => {
    const sentences = [
      "Happy birthday captain, fighting 💪🎉",
      "Selamat ulang tahun, semoga sukses selalu",
      "Know your number, no way! Captain America",
      "다인 선수 생일 축하해요",
    ];
    for (const sentence of sentences) expect(expandSlang(sentence)).toBe(sentence);
  });
});

describe("guessSourceLanguage", () => {
  it("picks Indonesian when typical words appear", () => {
    expect(guessSourceLanguage("Selamat ulang tahun captain Kim Dain, semoga bahagia")).toBe("id");
    expect(guessSourceLanguage("Selamat ulangtahun kakak da in.. sukses selalu")).toBe("id");
    expect(guessSourceLanguage("Happy B'day captain\nSehat bahagia, semoga bisa bawa team HH Juara")).toBe("id");
    expect(guessSourceLanguage("SEMOGA SUKSES!!")).toBe("id");
  });

  it("picks English for other Latin text and when unsure", () => {
    expect(guessSourceLanguage("Happy birthday my capt kim dain 🥳❤️‍🔥")).toBe("en");
    expect(guessSourceLanguage("Happy Bday our no 3.. may you be blessed")).toBe("en");
    expect(guessSourceLanguage("Danke! Dandelion")).toBe("en");
    expect(guessSourceLanguage("🎉🎉")).toBe("en");
  });

  it("picks Japanese when kana appear", () => {
    expect(guessSourceLanguage("お誕生日おめでとうございます！")).toBe("ja");
    expect(guessSourceLanguage("ダイン選手 happy birthday")).toBe("ja");
  });
});

describe("isUntranslated", () => {
  it("ignores spacing, case, punctuation and emoji", () => {
    expect(
      isUntranslated(
        "Happy Bday our no 3.. may you be blessed 🎉🏆",
        "Happy Bday our no 3.. May you be  blessed... 🎉🏆"
      )
    ).toBe(true);
    expect(isUntranslated("Happy Birthday to 김다인선수님!", "happy birthday to 김다인 선수님")).toBe(true);
  });

  it("treats a result without any Hangul as untranslated", () => {
    expect(isUntranslated("Happy birthday my capt", "Happy birthday, my captain")).toBe(true);
    expect(isUntranslated("🎉", "🎉")).toBe(true);
  });

  it("accepts real Korean translations, even with names left in Latin", () => {
    expect(isUntranslated("Happy birthday my captain Kim Dain", "Kim Dain 선장님 생일 축하합니다")).toBe(false);
    expect(isUntranslated("Happy birthday captennnn", "생일 축하합니다 captennnn")).toBe(false);
  });
});

describe("translateToKorean", () => {
  const langpairOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
    new URL(String(fetchMock.mock.calls[call][0])).searchParams.get("langpair");

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks with the guessed source language first", async () => {
    vi.stubEnv("NEXT_PUBLIC_MYMEMORY_EMAIL", "");
    const fetchMock = vi.fn(async () => jsonResponse(ok("생일 축하합니다")));
    await expect(translateToKorean("Selamat ulang tahun", fetchMock)).resolves.toBe("생일 축하합니다");
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe("https://api.mymemory.translated.net/get");
    expect(url.searchParams.get("q")).toBe("Selamat ulang tahun");
    expect(url.searchParams.get("langpair")).toBe("id|ko");
    expect(url.searchParams.has("de")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds the de parameter when an email is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_MYMEMORY_EMAIL", " fan@example.com ");
    const fetchMock = vi.fn(async () => jsonResponse(ok("생일 축하해요")));
    await translateToKorean("Happy birthday", fetchMock);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("langpair")).toBe("en|ko");
    expect(url.searchParams.get("de")).toBe("fan@example.com");
  });

  it("sends the slang-expanded text", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ok("다인 주장님 생일 축하해요")));
    await translateToKorean("Happy Bday my capt dain 🥳", fetchMock);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("q")).toBe("Happy Birthday my captain Dain 🥳");
    expect(url.searchParams.get("langpair")).toBe("en|ko");
  });

  it("retries in Indonesian when English comes back untranslated", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ok("Happy birthday our capt!")))
      .mockResolvedValueOnce(jsonResponse(ok("생일 축하해요 주장님")));
    await expect(translateToKorean("happy birthday our capt", fetchMock)).resolves.toBe("생일 축하해요 주장님");
    expect(langpairOf(fetchMock, 0)).toBe("en|ko");
    expect(langpairOf(fetchMock, 1)).toBe("id|ko");
  });

  it("retries in English when Indonesian fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ responseStatus: 403, responseData: { translatedText: "INVALID LANGUAGE PAIR" } }))
      .mockResolvedValueOnce(jsonResponse(ok("항상 건강하세요")));
    await expect(translateToKorean("semoga sehat selalu", fetchMock)).resolves.toBe("항상 건강하세요");
    expect(langpairOf(fetchMock, 0)).toBe("id|ko");
    expect(langpairOf(fetchMock, 1)).toBe("en|ko");
  });

  it("retries Japanese with autodetect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(ok("お誕生日おめでとう")))
      .mockResolvedValueOnce(jsonResponse(ok("생일 축하해")));
    await expect(translateToKorean("お誕生日おめでとう", fetchMock)).resolves.toBe("생일 축하해");
    expect(langpairOf(fetchMock, 0)).toBe("ja|ko");
    expect(langpairOf(fetchMock, 1)).toBe("autodetect|ko");
  });

  it("fails when both attempts return the original text", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ok("Happy birthday my capt kim dain 🥳")));
    await expect(translateToKorean("Happy birthday my capt kim dain 🥳", fetchMock)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up on a request after 8 seconds", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          })
      );
      const pending = translateToKorean("Happy birthday", fetchMock);
      await vi.advanceTimersByTimeAsync(7_999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(8_000);
      await expect(pending).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when every attempt fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse({}, 429));
    await expect(translateToKorean("halo", fetchMock)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not call the API for an empty message", async () => {
    const fetchMock = vi.fn();
    await expect(translateToKorean("   ", fetchMock)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
