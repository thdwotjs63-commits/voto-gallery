/** 2026-27 V리그 개막 D-day — 홈 배너용 순수 헬퍼 */

/** 개막일 (한국 날짜 YYYY-MM-DD) */
export const SEASON_OPENING_DATE_KEY = "2026-10-31";

function seoulDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 개막일까지 남은 일수. 개막 후면 null, 당일은 0. */
export function seasonOpeningDaysLeft(
  now: Date,
  openingKey = SEASON_OPENING_DATE_KEY
): number | null {
  const todayKey = seoulDateKey(now);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  const openingMs = Date.parse(`${openingKey}T00:00:00Z`);
  if (Number.isNaN(todayMs) || Number.isNaN(openingMs)) return null;
  const diff = Math.round((openingMs - todayMs) / (24 * 60 * 60 * 1000));
  if (diff < 0) return null;
  return diff;
}

export function seasonOpeningBannerLabel(daysLeft: number): string {
  if (daysLeft === 0) return "🏐 오늘 V-리그 개막!";
  return `🏐 2026-27 V-리그 개막 D-${daysLeft}`;
}
