"use client";

import type { TeamKoreaRecord } from "@/lib/schedule-data";

export function TeamKoreaBadge({ record }: { record: TeamKoreaRecord | null }) {
  if (!record) return null;
  const text =
    record.streakActive && record.streak >= 2
      ? `팀코리아 ${record.streak}연승 중!`
      : `팀코리아 2026 ${record.wins}승 ${record.losses}패`;

  return (
    <div className="mx-auto mb-4 flex w-fit max-w-[1100px] items-center justify-center gap-2 rounded-full bg-[#00287A] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(0,40,122,0.18)]">
      <span aria-hidden="true">🇰🇷</span>
      <span>{text}</span>
    </div>
  );
}
