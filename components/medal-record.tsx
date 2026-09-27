"use client";

import { TEAM_KOREA_2026_ACHIEVEMENTS, type MedalRecord } from "@/lib/schedule-data";

export function MedalRecordList({ medals, compact = false }: { medals: MedalRecord[]; compact?: boolean }) {
  const medalRows = medals ?? [];
  if (medalRows.length === 0 && TEAM_KOREA_2026_ACHIEVEMENTS.length === 0) return null;
  return (
    <div className={`mx-auto max-w-[1100px] rounded-2xl border border-amber-200 bg-amber-50/50 p-4 ${compact ? "mb-2" : "mb-4"}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700">2026 팀코리아 성과</p>
      <ul className="space-y-1">
        {medalRows.map((m, i) => (
          <li key={`medal-${i}`} className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-lg" aria-hidden="true">{m.emoji}</span>
            <span className="font-medium">{m.tournament}</span>
            <span className="text-zinc-400">{m.label}</span>
          </li>
        ))}
        {TEAM_KOREA_2026_ACHIEVEMENTS.map((a, i) => (
          <li key={`ach-${i}`} className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-lg" aria-hidden="true">{a.emoji}</span>
            <span className="font-medium">{a.tournament}</span>
            <span className="text-zinc-400">{a.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
