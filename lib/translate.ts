/** 생일 메시지 "번역 보기" — MyMemory 무료 API (키 불필요) */

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const TIMEOUT_MS = 8_000;

export type SourceLanguage = "id" | "en" | "ja";

/** 인도네시아어(일부 자바어 포함) 메시지에 자주 나오는 단어 */
const INDONESIAN_WORDS = new Set([
  "selamat",
  "ulang",
  "ulangtahun",
  "tahun",
  "semoga",
  "kakak",
  "kak",
  "banyak",
  "bahagia",
  "sukses",
  "juara",
  "musim",
  "buat",
  "yang",
  "dan",
  "untuk",
  "selalu",
  "sehat",
  "terbaik",
  "kapten",
  "diberi",
  "kelancaran",
  "membawa",
  "bisa",
  "ini",
  "kamu",
  "doa",
  "sugeng",
]);

/** 번역 대신 경고 문구가 translatedText 로 오는 경우 */
const WARNING_RE =
  /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR|PLEASE SELECT TWO DISTINCT LANGUAGES|NO QUERY SPECIFIED|INVALID SOURCE LANGUAGE/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** MyMemory 응답 → 한국어 번역. 실패·경고면 null */
export function parseMyMemoryResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { responseStatus, quotaFinished, responseData } = data as Record<string, unknown>;
  if (Number(responseStatus) !== 200 || quotaFinished === true) return null;
  if (!responseData || typeof responseData !== "object") return null;
  const text = (responseData as Record<string, unknown>).translatedText;
  if (typeof text !== "string") return null;
  const translated = decodeEntities(text).trim();
  if (!translated || WARNING_RE.test(translated)) return null;
  return translated;
}

/**
 * 글자가 들어 있는 단어 중 한글 단어가 절반 이상이면 번역이 필요 없는 메시지로 본다.
 * (한글은 한 글자에 음절이 모여 있어 글자 수로 비교하면 영어 쪽으로 기운다)
 */
export function isMostlyKorean(text: string): boolean {
  const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length === 0) return true;
  const korean = words.filter((word) => /\p{Script=Hangul}/u.test(word)).length;
  return korean / words.length >= 0.5;
}

const WORD_START = String.raw`(?<![\p{L}\p{N}'’&\-])`;
const WORD_END = String.raw`(?![\p{L}\p{N}'’&\-])`;

/** [찾을 단어(정규식 조각), 바꿀 말] — 단어 하나로 떨어져 있을 때만, 대소문자 무시 */
const SLANG_RULES: [string, string][] = [
  [String.raw`(?:thx|thank)\s+u`, "thank you"],
  [String.raw`b['’]?day|bdae`, "birthday"],
  [String.raw`capt(?:e?n+)?|cap`, "captain"],
  [String.raw`no\.?\s*(\d+)`, "number $1"],
  ["u", "you"],
  ["ur", "your"],
  ["r", "are"],
  ["tysm", "thank you so much"],
  ["thx|tq", "thank you"],
  ["pls|plz", "please"],
  ["congrats|congratz", "congratulations"],
  // 이름이 소문자면 MyMemory가 번역을 포기하고 원문을 돌려준다
  [String.raw`kim\s*da\s*in`, "Kim Dain"],
  [String.raw`da\s?in`, "Dain"],
];

const SLANG_PATTERNS = SLANG_RULES.map(
  ([word, replacement]) => [new RegExp(`${WORD_START}(?:${word})${WORD_END}`, "giu"), replacement] as const
);

/** 번역기에 보낼 때만 쓰는 정규화: 흔한 축약어·슬랭을 정식 단어로 바꾼다 (화면의 원문은 그대로) */
export function expandSlang(text: string): string {
  return SLANG_PATTERNS.reduce(
    (result, [pattern, replacement]) =>
      result.replace(pattern, (match: string, ...groups: unknown[]) => {
        const expanded = replacement.replace("$1", typeof groups[0] === "string" ? groups[0] : "");
        return /^\p{Lu}/u.test(match) && /^\p{Ll}/u.test(expanded)
          ? expanded[0].toUpperCase() + expanded.slice(1)
          : expanded;
      }),
    text
  );
}

/** 원문 언어 추정: 가나 → ja, 인니어 단어 → id, 그 외(애매한 경우 포함) → en */
export function guessSourceLanguage(text: string): SourceLanguage {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.some((word) => INDONESIAN_WORDS.has(word)) ? "id" : "en";
}

const RETRY_SOURCE: Record<SourceLanguage, string> = { id: "en", en: "id", ja: "autodetect" };

function normalizeForCompare(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 번역 결과가 사실상 원문 그대로인지. 공백·대소문자·문장부호·이모지를 무시하고 같거나,
 * 한글이 한 글자도 없으면(원문을 거의 그대로 돌려준 경우) 번역 실패로 본다.
 */
export function isUntranslated(original: string, translated: string): boolean {
  const normalized = normalizeForCompare(translated);
  if (!normalized || normalized === normalizeForCompare(original)) return true;
  return !/\p{Script=Hangul}/u.test(translated);
}

async function requestTranslation(
  text: string,
  source: string,
  fetchImpl: typeof fetch
): Promise<string | null> {
  const url = new URL(MYMEMORY_ENDPOINT);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|ko`);
  const email = process.env.NEXT_PUBLIC_MYMEMORY_EMAIL?.trim();
  if (email) url.searchParams.set("de", email);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const translated = parseMyMemoryResponse(await response.json());
    return translated && !isUntranslated(text, translated) ? translated : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 슬랭을 풀어 쓴 문장을 추정한 원문 언어로 번역하고, 비었거나 원문 그대로면 다른 언어로 한 번 더.
 * 둘 다 실패하면 null
 */
export async function translateToKorean(
  text: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const q = expandSlang(text.trim());
  if (!q) return null;
  const source = guessSourceLanguage(q);
  return (
    (await requestTranslation(q, source, fetchImpl)) ??
    (await requestTranslation(q, RETRY_SOURCE[source], fetchImpl))
  );
}
