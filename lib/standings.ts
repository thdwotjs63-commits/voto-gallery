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
  /**
   * 점수 득실률 — 시트에 직접 입력한 값(없으면 null).
   * 세트 득실률이 같을 때의 타이브레이커. 자동 계산하지 않는다.
   */
  pointRatio: number | null;
};

type Acc = {
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  /** 시트에서 입력한 점수 득실률 — 그 팀의 가장 최근(마지막) 경기 행 값 */
  pointRatio: number | null;
  /** pointRatio 를 어느 날짜 행에서 가져왔는지 (더 최근 값으로 갱신하려고) */
  pointRatioDate: string;
};

function emptyAcc(): Acc {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    points: 0,
    setsWon: 0,
    setsLost: 0,
    pointRatio: null,
    pointRatioDate: "",
  };
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

    // 점수 득실률: 시트 "점수득실률" 칸은 그 행의 team_a(왼쪽 팀) 리그 전체 득실률이다.
    // 팬이 네이버에서 보고 team_a 팀의 누적 득실률을 직접 적는 방식 → team_a 에만 반영,
    // 그 팀의 가장 최근(마지막) 경기 행 값을 최신으로 쓴다.
    const d = (m.date ?? "").trim();
    if (m.pointRatio != null && d >= left.pointRatioDate) {
      left.pointRatio = m.pointRatio;
      left.pointRatioDate = d;
    }
  }

  if (byTeam.size === 0) return [];

  const rows = [...byTeam.entries()].map(([team, acc]) => ({
    team,
    ...acc,
    setRatio: setRatio(acc.setsWon, acc.setsLost),
  }));

  // KOVO 순위 기준: 승점 → 승수 → 세트 득실률 → 점수 득실률 → 팀명
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.setRatio !== x.setRatio) return y.setRatio - x.setRatio;
    // 점수 득실률: 둘 다 입력돼 있을 때만 타이브레이커로 사용 (없으면 건너뜀)
    if (x.pointRatio != null && y.pointRatio != null && y.pointRatio !== x.pointRatio) {
      return y.pointRatio - x.pointRatio;
    }
    return x.team.localeCompare(y.team, "ko");
  });

  return rows.map((row, i) => ({
    rank: i + 1,
    team: row.team,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    points: row.points,
    setsWon: row.setsWon,
    setsLost: row.setsLost,
    setRatio: row.setRatio,
    pointRatio: row.pointRatio,
  }));
}

/** 표시용 세트 득실률 (무한대는 ∞) */
export function formatSetRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return "∞";
  if (ratio === 0) return "0.000";
  return ratio.toFixed(3);
}

/** 표시용 점수 득실률 (없으면 "-") */
export function formatPointRatio(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return "-";
  return ratio.toFixed(3);
}
