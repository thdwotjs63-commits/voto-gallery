/** 마감 카운트다운 계산 — 순수 함수 */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 남은 시간을 초 단위로 올림해서 나눈다. 마감이 지났으면 null */
export function splitCountdown(remainingMs: number): CountdownParts | null {
  const total = Math.ceil(remainingMs / 1000);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** 24시간 미만이면 마감 임박 */
export function isCountdownUrgent(parts: CountdownParts): boolean {
  return parts.days === 0;
}

/** "10일 06:12:33" / 24시간 미만은 "06:12:33" */
export function formatCountdown(parts: CountdownParts): string {
  const clock = `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
  return parts.days > 0 ? `${parts.days}일 ${clock}` : clock;
}

/** 화면 읽기용 문구 — 분 단위까지만 바뀐다 */
export function countdownAriaLabel(parts: CountdownParts): string {
  if (parts.days > 0) return `마감까지 ${parts.days}일 ${parts.hours}시간 남음`;
  if (parts.hours > 0) return `마감까지 ${parts.hours}시간 ${parts.minutes}분 남음`;
  if (parts.minutes > 0) return `마감까지 ${parts.minutes}분 남음`;
  return "마감까지 1분 미만 남음";
}
