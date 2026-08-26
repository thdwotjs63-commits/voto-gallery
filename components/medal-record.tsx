"use client";

import type { MedalRecord } from "@/lib/schedule-data";

export function MedalRecordList({ medals, compact = false }: { medals: MedalRecord[]; compact?: boolean }) {
  if (!medals || medals.length === 0) return null;
  return (
    <div className={`mx-auto max-w-[1100px] rounded-2xl border border-amber-200 bg-amber-50/50 p-4 ${compact ? "mb-2" : "mb-4"}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700">2026 팀코리아 성과</p>
      <ul className="space-y-1">
        {medals.map((m, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="text-lg" aria-hidden="true">{m.emoji}</span>
            <span className="font-medium">{m.tournament}</span>
            <span className="text-zinc-400">{m.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
