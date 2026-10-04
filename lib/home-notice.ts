/** 홈 공지 팝업 카드 노출 기간 계산 — 날짜는 모두 한국 시간 기준 YYYY-MM-DD */

import { formatSeoulClockLabel } from "./birthday";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function seoulDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateKeyToUtcMs(key: string): number | null {
  if (!DATE_KEY_RE.test(key)) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 생일 카드 pill 문구. showFrom 날짜부터 마감 시각 전까지만 보이고, 그 밖이면 null.
 * 마감 당일은 "오늘 밤 10시 마감", 그 전에는 생일까지 남은 "D-n".
 */
export function birthdayCardPill(
  now: Date,
  showFromKey: string,
  birthdayKey: string,
  deadline: Date
): string | null {
  if (now >= deadline) return null;
  const todayKey = seoulDateKey(now);
  const today = dateKeyToUtcMs(todayKey);
  const showFrom = dateKeyToUtcMs(showFromKey);
  const birthday = dateKeyToUtcMs(birthdayKey);
  if (today === null || showFrom === null || birthday === null) return null;
  if (today < showFrom) return null;
  if (todayKey === seoulDateKey(deadline)) {
    return `오늘 ${formatSeoulClockLabel(deadline)} 마감`;
  }
  return `D-${Math.round((birthday - today) / DAY_MS)}`;
}

export function isOnOrBeforeDate(todayKey: string, endKey: string): boolean {
  const today = dateKeyToUtcMs(todayKey);
  const end = dateKeyToUtcMs(endKey);
  if (today === null || end === null) return false;
  return today <= end;
}
