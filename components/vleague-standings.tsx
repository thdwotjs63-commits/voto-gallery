"use client";

import Link from "next/link";
import { formatSetRatio, type TeamStanding } from "@/lib/standings";

const HYUNDAI = "현대건설";

function isHyundai(team: string): boolean {
  return team.includes(HYUNDAI);
}

type Props = {
  standings: TeamStanding[];
  /** 홈용: 상단 N팀만 (현대건설이 밖이면 함께 붙임). 미지정 시 전체 */
  maxRows?: number;
  /** 홈에서 일정 페이지로 유도 */
  showScheduleLink?: boolean;
  className?: string;
};

function pickRows(standings: TeamStanding[], maxRows?: number): TeamStanding[] {
  if (!maxRows || standings.length <= maxRows) return standings;
  const head = standings.slice(0, maxRows);
  const hyundai = standings.find((r) => isHyundai(r.team));
  if (hyundai && !head.some((r) => r.team === hyundai.team)) {
    return [...head, hyundai];
  }
  return head;
}

export function VLeagueStandings({
  standings,
  maxRows,
  showScheduleLink = false,
  className = "",
}: Props) {
  const rows = pickRows(standings, maxRows);
  const truncated = Boolean(maxRows && standings.length > maxRows);

  return (
    <section
      className={`mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-[#00287A]/15 bg-white shadow-[0_8px_24px_rgba(0,40,122,0.08)] ${className}`}
      aria-label="2025-26 V-리그 순위"
    >
      <div className="flex items-start justify-between gap-3 bg-[#00287A] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold tracking-wide text-white sm:text-[14px]">
            2025-26 V-리그 순위
          </h2>
          <p className="mt-0.5 text-[11px] text-white/70">
            경기 결과가 반영되면 자동 갱신돼요
          </p>
        </div>
        {showScheduleLink ? (
          <Link
            href="/schedule"
            className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white/25"
          >
            전체 보기
          </Link>
        ) : null}
      </div>

      {standings.length === 0 ? (
        <p className="px-4 py-5 text-center text-[13px] text-[#00287A]/55">
          V리그 개막 후 순위가 표시돼요
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-[12px] sm:text-[13px]">
            <thead>
              <tr className="border-b border-[#00287A]/10 bg-[#F4F7FC] text-[10px] font-semibold uppercase tracking-wider text-[#00287A]/65 sm:text-[11px]">
                <th className="px-2 py-2.5 text-center sm:px-3">순위</th>
                <th className="px-2 py-2.5 sm:px-3">팀</th>
                <th className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">경기</th>
                <th className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">승</th>
                <th className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">패</th>
                <th className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">승점</th>
                <th className="hidden px-2 py-2.5 text-center tabular-nums sm:table-cell sm:px-3">
                  세트득실률
                </th>
                <th className="px-2 py-2.5 text-center tabular-nums sm:hidden">세트</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hyundai = isHyundai(row.team);
                return (
                  <tr
                    key={row.team}
                    className={
                      hyundai
                        ? "bg-[#00287A] text-white"
                        : "border-b border-[#00287A]/06 text-[#0C2444] last:border-0"
                    }
                  >
                    <td className="px-2 py-2.5 text-center font-bold tabular-nums sm:px-3">
                      {row.rank}
                    </td>
                    <td className="max-w-[7.5rem] truncate px-2 py-2.5 font-semibold sm:max-w-none sm:px-3">
                      {row.team}
                      {hyundai ? (
                        <span className="ml-1 text-[10px] font-bold text-amber-300">HOME</span>
                      ) : null}
                    </td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">{row.played}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">{row.wins}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums sm:px-2">{row.losses}</td>
                    <td
                      className={`px-1.5 py-2.5 text-center font-bold tabular-nums sm:px-2 ${
                        hyundai ? "text-amber-300" : "text-[#00287A]"
                      }`}
                    >
                      {row.points}
                    </td>
                    <td
                      className={`hidden px-2 py-2.5 text-center tabular-nums sm:table-cell sm:px-3 ${
                        hyundai ? "text-white/85" : "text-[#00287A]/70"
                      }`}
                    >
                      {formatSetRatio(row.setRatio)}
                      <span className={`ml-1 text-[10px] ${hyundai ? "text-white/50" : "text-[#00287A]/40"}`}>
                        ({row.setsWon}-{row.setsLost})
                      </span>
                    </td>
                    <td
                      className={`px-2 py-2.5 text-center tabular-nums sm:hidden ${
                        hyundai ? "text-white/85" : "text-[#00287A]/70"
                      }`}
                    >
                      {row.setsWon}-{row.setsLost}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {truncated && showScheduleLink ? (
            <p className="border-t border-[#00287A]/08 px-4 py-2.5 text-center text-[11px] text-[#00287A]/55">
              상위 {maxRows}팀 · 전체 순위는 일정 페이지에서
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
