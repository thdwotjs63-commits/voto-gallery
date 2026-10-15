/** 생일 메시지북 페이지 구성 — 클라이언트/서버 공용 (순수 함수) */

import { isMostlyKorean, type SourceLanguage } from "./translate";

export type BookMessage = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
  /** 외국어 메시지의 한국어 번역 (서버에서 미리 붙임, 실패하면 없음) */
  translation?: string;
  sourceLang?: SourceLanguage;
};

export type BookPage =
  | { kind: "cover"; count: number }
  | { kind: "letter" }
  | { kind: "messages"; items: BookMessage[] }
  | { kind: "foreign-intro" }
  | { kind: "foreign"; items: BookMessage[] }
  | { kind: "empty" }
  | { kind: "end"; count: number };

/** 한국어가 아닌 메시지 → 책 뒤 "해외 팬들의 메시지" 섹션 */
export function isForeignBookMessage(message: string): boolean {
  return !isMostlyKorean(message);
}

/** 이보다 짧은 메시지 두 개는 한 페이지에 함께 싣는다 */
const PAIR_ITEM_MAX_WEIGHT = 220;
const PAIR_TOTAL_MAX_WEIGHT = 380;
const LINE_BREAK_WEIGHT = 18;

export function bookMessageWeight(message: string): number {
  const lineBreaks = (message.match(/\n/g) ?? []).length;
  return message.length + lineBreaks * LINE_BREAK_WEIGHT;
}

export function isLongBookMessage(message: string): boolean {
  return bookMessageWeight(message) > PAIR_ITEM_MAX_WEIGHT;
}

/** 번역이 붙은 메시지는 원문 아래 번역까지 실리니 둘을 합친 길이로 본다 */
export function bookItemWeight(item: BookMessage): number {
  return bookMessageWeight(item.message) + (item.translation ? bookMessageWeight(item.translation) : 0);
}

export function isLongBookItem(item: BookMessage): boolean {
  return bookItemWeight(item) > PAIR_ITEM_MAX_WEIGHT;
}

export function paginateBookMessages(messages: readonly BookMessage[]): BookMessage[][] {
  const pages: BookMessage[][] = [];
  let i = 0;
  while (i < messages.length) {
    const first = messages[i];
    const second = messages[i + 1];
    const firstWeight = bookItemWeight(first);
    const secondWeight = second ? bookItemWeight(second) : 0;
    if (
      second &&
      firstWeight <= PAIR_ITEM_MAX_WEIGHT &&
      secondWeight <= PAIR_ITEM_MAX_WEIGHT &&
      firstWeight + secondWeight <= PAIR_TOTAL_MAX_WEIGHT
    ) {
      pages.push([first, second]);
      i += 2;
    } else {
      pages.push([first]);
      i += 1;
    }
  }
  return pages;
}

/** 검토 페이지에서 숨긴 메시지를 빼고, 책에 필요한 필드만 남긴다 */
export function selectVisibleBookMessages(
  messages: readonly BookMessage[],
  hiddenIds: readonly string[],
): BookMessage[] {
  const hidden = new Set(hiddenIds);
  return messages
    .filter((m) => !hidden.has(m.id))
    .map(({ id, nickname, message, created_at }) => ({ id, nickname, message, created_at }));
}

/** 표지 → 편지 → 한국어 메시지 → (있으면) 해외 팬 구분 페이지 + 외국어 메시지 → 끝 */
export function buildBookPages(messages: readonly BookMessage[]): BookPage[] {
  if (messages.length === 0) {
    return [{ kind: "cover", count: 0 }, { kind: "letter" }, { kind: "empty" }, { kind: "end", count: 0 }];
  }
  const korean = messages.filter((m) => !isForeignBookMessage(m.message));
  const foreign = messages.filter((m) => isForeignBookMessage(m.message));
  const body: BookPage[] = paginateBookMessages(korean).map((items) => ({ kind: "messages", items }));
  if (foreign.length > 0) {
    body.push(
      { kind: "foreign-intro" },
      ...paginateBookMessages(foreign).map((items): BookPage => ({ kind: "foreign", items }))
    );
  }
  return [
    { kind: "cover", count: messages.length },
    { kind: "letter" },
    ...body,
    { kind: "end", count: messages.length },
  ];
}

/** 사용자가 친 페이지 번호(1부터) → 범위 안으로 보정한 페이지 인덱스. 숫자가 없으면 null */
export function parseBookPageInput(raw: string, total: number): number | null {
  if (total <= 0) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const pageNumber = Number(digits);
  return Math.min(Math.max(pageNumber, 1), total) - 1;
}

function normalizeNickname(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

export type BookNicknameHit = { nickname: string; pageIndex: number };

/** 닉네임 일부(대소문자·공백 무시)로 메시지가 실린 페이지를 책 순서대로 찾는다. 같은 페이지의 같은 닉네임은 한 번만 */
export function findMessagePagesByNickname(pages: readonly BookPage[], query: string): BookNicknameHit[] {
  const needle = normalizeNickname(query);
  if (!needle) return [];
  const hits: BookNicknameHit[] = [];
  pages.forEach((page, pageIndex) => {
    if (page.kind !== "messages" && page.kind !== "foreign") return;
    const seen = new Set<string>();
    for (const item of page.items) {
      if (seen.has(item.nickname) || !normalizeNickname(item.nickname).includes(needle)) continue;
      seen.add(item.nickname);
      hits.push({ nickname: item.nickname, pageIndex });
    }
  });
  return hits;
}

const BOOK_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국 시간 기준 "2026.10.08" */
export function formatBookDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return BOOK_DATE_FORMAT.format(date).replaceAll("-", ".");
}

export function isBookMessageId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
