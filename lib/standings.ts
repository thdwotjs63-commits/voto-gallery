/** V리그 정규시즌 순위 — 세트 스코어로 승점·세트득실 집계 (순수 함수) */

import type { Match } from "./schedule-data";

export type TeamStanding = {
  rank: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  /** 세트 득실률 (setsWon / setsLost). 실세트 0이면 Infinity(승세트 있을 때) 또는 0 */
  setRatio: number;
};

type Acc = {
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
};

function emptyAcc(): Acc {
  return { played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 };
}

/** V리그 승점: 3-0/3-1 승=3, 3-2 승=2, 2-3 패=1, 0-3/1-3 패=0 */
export function vLeagueMatchPoints(mySets: number, oppSets: number): number {
  if (mySets > oppSets) {
    return oppSets <= 1 ? 3 : 2;
  }
  return mySets === 2 ? 1 : 0;
}

function isCompletedVLeagueRegular(m: Match): boolean {
  if ((m.category ?? "").trim() !== "브이리그") return false;
  if (!(m.tournament ?? "").includes("정규시즌")) return false;
  const a = Number(m.scoreA);
  const b = Number(m.scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return true;
}

function setRatio(setsWon: number, setsLost: number): number {
  if (setsLost === 0) return setsWon > 0 ? Number.POSITIVE_INFINITY : 0;
  return setsWon / setsLost;
}

/**
 * 브이리그 정규시즌 완료 경기만으로 순위표를 만든다.
 * 경기가 하나도 없으면 빈 배열.
 */
export function computeVLeagueStandings(matches: readonly Match[]): TeamStanding[] {
  const byTeam = new Map<string, Acc>();

  const ensure = (team: string) => {
    let acc = byTeam.get(team);
    if (!acc) {
      acc = emptyAcc();
      byTeam.set(team, acc);
    }
    return acc;
  };

  for (const m of matches) {
    if (!isCompletedVLeagueRegular(m)) continue;
    const a = Number(m.scoreA);
    const b = Number(m.scoreB);
    const teamA = (m.teamA ?? "").trim();
    const teamB = (m.teamB ?? "").trim();
    if (!teamA || !teamB) continue;

    const left = ensure(teamA);
    const right = ensure(teamB);

    left.played += 1;
    right.played += 1;
    left.setsWon += a;
    left.setsLost += b;
    right.setsWon += b;
    right.setsLost += a;

    left.points += vLeagueMatchPoints(a, b);
    right.points += vLeagueMatchPoints(b, a);

    if (a > b) {
      left.wins += 1;
      right.losses += 1;
    } else {
      right.wins += 1;
      left.losses += 1;
    }
  }

  if (byTeam.size === 0) return [];

  const rows = [...byTeam.entries()].map(([team, acc]) => ({
    team,
    ...acc,
    setRatio: setRatio(acc.setsWon, acc.setsLost),
  }));

  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.setRatio !== x.setRatio) return y.setRatio - x.setRatio;
    return x.team.localeCompare(y.team, "ko");
  });

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}

/** 표시용 세트 득실률 (무한대는 ∞) */
export function formatSetRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return "∞";
  if (ratio === 0) return "0.000";
  return ratio.toFixed(3);
}
