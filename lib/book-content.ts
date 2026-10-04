/** 생일 메시지북 고정 문구 — 엮은이 편지는 직접 채워 넣는다 */

export const BOOK_TITLE_LINES = ["2026", "김다인", "생일 축하", "메시지북"] as const;
export const BOOK_DATE_LABEL = "2026.10.15";

export const BOOK_EDITOR_LETTER = {
  title: "엮은이의 편지",
  paragraphs: [
    "여기에 편지 첫 문단을 적어 주세요.",
    "문단은 배열에 한 줄씩 추가하면 돼요.",
  ],
  signature: "daeni.kr 드림",
} as const;
