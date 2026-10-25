"use client";

import Link from "next/link";
import { useClock } from "@/lib/clock";
import {
  seasonOpeningBannerLabel,
  seasonOpeningDaysLeft,
} from "@/lib/season-opening";

const BANNER_SURFACE =
  "rounded-2xl border border-white/20 bg-[#1E3A9E]/78 text-white shadow-[0_8px_24px_rgba(0,40,122,0.28)] backdrop-blur-md supports-[backdrop-filter]:bg-[#1E3A9E]/65";

/** 홈 히어로 위 개막 D-day 배너 — 개막 후면 아무것도 그리지 않는다 */
export function SeasonOpeningBanner({ className = "" }: { className?: string }) {
  const now = useClock();
  if (now === null) return null;

  const daysLeft = seasonOpeningDaysLeft(new Date(now));
  if (daysLeft === null) return null;

  return (
    <div className={className}>
      <Link
        href="/schedule"
        className={`mx-auto flex max-w-[1100px] items-center justify-center break-keep px-4 py-2.5 text-center transition active:scale-[0.99] sm:px-5 sm:py-3 ${BANNER_SURFACE}`}
      >
        <p className="text-[14px] font-extrabold leading-snug tracking-wide sm:text-[16px]">
          {seasonOpeningBannerLabel(daysLeft)}
        </p>
      </Link>
    </div>
  );
}
