"use client";

import { useBirthdayMessageCounts } from "@/lib/birthday-counts-client";

/** "💌 N명 참여 중" — 개수를 못 불러오면 아무것도 그리지 않는다 */
export function BirthdayParticipants({ className = "" }: { className?: string }) {
  const state = useBirthdayMessageCounts();
  if (state.status !== "ready") return null;
  return <p className={className}>💌 {state.counts.total}명 참여 중</p>;
}
