/** 생일 메시지북 페이지 구성 — 클라이언트/서버 공용 (순수 함수) */

export type BookMessage = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
};

export type BookPage =
  | { kind: "cover" }
  | { kind: "letter" }
  | { kind: "messages"; items: BookMessage[] }
  | { kind: "empty" }
  | { kind: "end"; count: number };

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

export function paginateBookMessages(messages: readonly BookMessage[]): BookMessage[][] {
  const pages: BookMessage[][] = [];
  let i = 0;
  while (i < messages.length) {
    const first = messages[i];
    const second = messages[i + 1];
    const firstWeight = bookMessageWeight(first.message);
    if (
      second &&
      firstWeight <= PAIR_ITEM_MAX_WEIGHT &&
      bookMessageWeight(second.message) <= PAIR_ITEM_MAX_WEIGHT &&
      firstWeight + bookMessageWeight(second.message) <= PAIR_TOTAL_MAX_WEIGHT
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

export function buildBookPages(messages: readonly BookMessage[]): BookPage[] {
  const body: BookPage[] =
    messages.length === 0
      ? [{ kind: "empty" }]
      : paginateBookMessages(messages).map((items) => ({ kind: "messages", items }));
  return [{ kind: "cover" }, { kind: "letter" }, ...body, { kind: "end", count: messages.length }];
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
