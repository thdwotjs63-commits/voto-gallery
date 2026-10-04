"use client";

import { useClock } from "@/lib/clock";
import {
  countdownAriaLabel,
  formatCountdown,
  isCountdownUrgent,
  splitCountdown,
} from "@/lib/countdown";

type Variant = "banner" | "popup";

type Props = {
  deadline: Date;
  /** 숫자 앞에 붙는 문구, 예: "메시지 마감까지" */
  label?: string;
  variant?: Variant;
  className?: string;
};

const PLACEHOLDER = "00일 00:00:00";

const STYLES: Record<
  Variant,
  { label: string; urgentTag: string; time: string; urgentTime: string }
> = {
  banner: {
    label: "text-[14px] font-semibold text-white/90 sm:text-[15px]",
    urgentTag: "text-[14px] font-extrabold text-white sm:text-[15px]",
    time: "min-w-[6.4em] text-[30px] font-extrabold leading-none text-white sm:text-[34px]",
    urgentTime:
      "rounded-lg bg-white px-2 py-1 text-[30px] font-extrabold leading-none text-[#C8202C] sm:text-[34px]",
  },
  popup: {
    label: "text-[13px] font-semibold text-[#55524b]",
    urgentTag: "text-[13px] font-extrabold text-[#C8202C]",
    time: "min-w-[6.4em] text-[18px] font-extrabold leading-tight text-[#1c1c24]",
    urgentTime: "text-[18px] font-extrabold leading-tight text-[#C8202C]",
  },
};

/** 마감까지 남은 시간. 마운트 전에는 자리만 잡고, 마감이 지나면 사라진다. */
export function BirthdayCountdown({ deadline, label, variant = "banner", className = "" }: Props) {
  const now = useClock();
  const parts = now === null ? null : splitCountdown(deadline.getTime() - now);
  if (now !== null && parts === null) return null;

  const styles = STYLES[variant];
  const urgent = parts !== null && isCountdownUrgent(parts);

  return (
    <span
      role="timer"
      aria-label={parts ? countdownAriaLabel(parts) : undefined}
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}
    >
      {label ? (
        <span aria-hidden className={styles.label}>
          {label}
        </span>
      ) : null}
      {urgent ? (
        <span aria-hidden className={styles.urgentTag}>
          ⏰ 오늘 마감
        </span>
      ) : null}
      <span
        aria-hidden
        className={`whitespace-nowrap tabular-nums ${urgent ? styles.urgentTime : styles.time}`}
      >
        {parts ? formatCountdown(parts) : <span className="invisible">{PLACEHOLDER}</span>}
      </span>
    </span>
  );
}
