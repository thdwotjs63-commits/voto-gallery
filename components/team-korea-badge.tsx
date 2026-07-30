"use client";

import type { TeamKoreaRecord } from "@/lib/schedule-data";

type Tone = "navy" | "white";

const TONE_STYLE: Record<Tone, string> = {
  navy: "bg-[#00287A]/[0.06] text-[#00287A]",
  white: "bg-white/10 text-white",
};

export function TeamKoreaBadge({
  record,
  tone = "navy",
}: {
  record: TeamKoreaRecord | null;
  tone?: Tone;
}) {
  if (!record) return null;
  const text =
    record.streakActive && record.streak >= 2
      ? `팀코리아 ${record.streak}연승 중!`
      : `팀코리아 2026 ${record.wins}승 ${record.losses}패`;

  return (
    <div
      className={`mx-auto mb-4 flex max-w-[1100px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${TONE_STYLE[tone]}`}
    >
      <span aria-hidden="true">🇰🇷</span>
      <span>{text}</span>
    </div>
  );
}
