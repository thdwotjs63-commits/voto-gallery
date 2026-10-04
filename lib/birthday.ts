/** 생일 메시지 접수 마감 — /birthday 페이지, 홈 배너, 홈 팝업이 함께 쓴다 */
export const BIRTHDAY_DEADLINE = new Date("2026-10-14T22:00:00+09:00"); // KST 마감

/** 한국 시간 YYYY-MM-DD */
export const BIRTHDAY_DATE_KEY = "2026-10-15"; // 생일 날짜
export const BIRTHDAY_NOTICE_SHOW_FROM = "2026-10-04"; // 이 날부터 홈 배너·팝업 카드 노출

export const BIRTHDAY_NICKNAME_MAX = 20;
export const BIRTHDAY_MESSAGE_MAX = 500;

const SEOUL_CLOCK_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function seoulClockParts(date: Date) {
  const parts = SEOUL_CLOCK_FORMAT.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { month: pick("month"), day: pick("day"), hour: pick("hour"), minute: pick("minute") };
}

/** 한국 시간 기준 "밤 10시", "오후 3시 30분" */
export function formatSeoulClockLabel(date: Date): string {
  const { hour, minute } = seoulClockParts(date);
  const period = hour < 12 ? "오전" : hour < 18 ? "오후" : "밤";
  const hour12 = hour % 12 || 12;
  return minute ? `${period} ${hour12}시 ${minute}분` : `${period} ${hour12}시`;
}

/** 한국 시간 기준 "10/14 밤 10시" */
export function formatSeoulDeadlineLabel(date: Date): string {
  const { month, day } = seoulClockParts(date);
  return `${month}/${day} ${formatSeoulClockLabel(date)}`;
}

export const BIRTHDAY_CLOSED_MESSAGE = `메시지 접수가 마감되었습니다 (${formatSeoulDeadlineLabel(
  BIRTHDAY_DEADLINE
)} 마감). 따뜻한 축하 감사합니다! 모인 메시지는 생일 당일 다인이에게 전달됩니다.`;

export type BirthdayMessage = {
  nickname: string;
  message: string;
  created_at: string;
};

export function isBirthdayClosed(now: Date = new Date()): boolean {
  const isClosed = now >= BIRTHDAY_DEADLINE;
  return isClosed;
}

const BIRTHDAY_DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatBirthdayMessageDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return BIRTHDAY_DATE_FORMAT.format(date);
}

/** Postgres RLS 위반(42501)은 마감 이후 DB가 insert를 막은 경우로 본다. */
export function birthdaySubmitErrorMessage(
  error: { code?: string | null; message?: string | null } | null | undefined,
  now: Date = new Date()
): string {
  if (isBirthdayClosed(now) || error?.code === "42501") {
    return "메시지 접수가 마감되었습니다";
  }
  const text = (error?.message ?? "").toLowerCase();
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "인터넷 연결을 확인하고 다시 시도해 주세요";
  }
  return "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요";
}
