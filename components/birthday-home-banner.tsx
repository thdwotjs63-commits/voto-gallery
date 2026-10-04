"use client";

import Link from "next/link";
import {
  BIRTHDAY_DATE_KEY,
  BIRTHDAY_DEADLINE,
  BIRTHDAY_NOTICE_SHOW_FROM,
} from "@/lib/birthday";
import { useClock } from "@/lib/clock";
import { birthdayBannerState } from "@/lib/home-notice";
import { BirthdayCountdown } from "./birthday-countdown";
import { BirthdayParticipants } from "./birthday-participants";

const BIRTHDAY_URL = "/birthday";
const BANNER_SURFACE =
  "rounded-2xl bg-[linear-gradient(135deg,#E2343F_0%,#C8202C_55%,#A11620_100%)] text-white shadow-[0_12px_28px_rgba(120,10,20,0.35)]";

/** 홈 첫 화면 생일 배너 — 노출 기간 밖이거나 마운트 전에는 아무것도 그리지 않는다 */
export function BirthdayHomeBanner({ className = "" }: { className?: string }) {
  const now = useClock();
  const state =
    now === null
      ? null
      : birthdayBannerState(
          new Date(now),
          BIRTHDAY_NOTICE_SHOW_FROM,
          BIRTHDAY_DATE_KEY,
          BIRTHDAY_DEADLINE
        );
  if (!state) return null;

  if (state === "celebrate") {
    return (
      <div className={className}>
        <p
          className={`mx-auto max-w-[1100px] break-keep px-5 py-4 text-center text-[17px] font-extrabold leading-snug sm:py-5 sm:text-[20px] ${BANNER_SURFACE}`}
        >
          🎂 오늘은 봉탄신일! 다인 선수 생일 축하해요
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Link
        href={BIRTHDAY_URL}
        className={`group mx-auto flex max-w-[1100px] flex-col gap-3.5 break-keep p-5 transition active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-6 ${BANNER_SURFACE}`}
      >
        <div className="min-w-0">
          <p className="text-[19px] font-extrabold leading-tight sm:text-[24px]">
            🎂 봉탄신일이 다가옵니다!
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-white/90 sm:text-[16px]">
            다인 선수에게 생일 축하 메시지를 남겨주세요
          </p>
          <BirthdayParticipants className="mt-1.5 text-[13px] font-bold text-white sm:text-[14px]" />
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <BirthdayCountdown deadline={BIRTHDAY_DEADLINE} label="메시지 마감까지" variant="banner" />
          <span className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-[15px] font-bold text-[#C8202C] transition group-hover:bg-white/90 sm:min-h-11">
            💌 생일 메시지 쓰러 가기
          </span>
        </div>
      </Link>
    </div>
  );
}
