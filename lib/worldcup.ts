/** 생일 기념 사진 월드컵 — 대진 생성·라운드 진행·부전승 (순수 함수) */

export const WORLDCUP_MAX_SIZE = 32;
export const WORLDCUP_MIN_SIZE = 4;

/** 쓸 수 있는 최대 강 수(4·8·16·32). 4장 미만이면 null */
export function worldcupSize(photoCount: number): number | null {
  const limit = Math.min(photoCount, WORLDCUP_MAX_SIZE);
  if (limit < WORLDCUP_MIN_SIZE) return null;
  let size = WORLDCUP_MIN_SIZE;
  while (size * 2 <= limit) size *= 2;
  return size;
}

/** 순번 앞에서부터 강 수만큼 */
export function pickWorldcupEntrants<T>(photos: readonly T[]): T[] {
  const size = worldcupSize(photos.length);
  return size ? photos.slice(0, size) : [];
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type Tournament = {
  /** 이번 라운드 대진 순서. [0]vs[1], [2]vs[3] … 홀수면 마지막이 부전승 */
  entrants: string[];
  /** 다음 라운드 진출자 */
  winners: string[];
  /** 이번 라운드에서 지금 치를 대결 (0부터) */
  matchIndex: number;
  /** 몇 번째 라운드인지 (1부터) */
  round: number;
  champion: string | null;
};

export type MatchResult = { winner: string; loser: string };

/** 이번 라운드 대결이 다 끝났으면 부전승을 올리고 다음 라운드로 넘긴다 */
function settle(t: Tournament): Tournament {
  let state = t;
  while (state.champion === null && state.matchIndex >= Math.floor(state.entrants.length / 2)) {
    const bye = state.entrants.length % 2 === 1 ? [state.entrants[state.entrants.length - 1]] : [];
    const advanced = [...state.winners, ...bye];
    if (advanced.length <= 1) return { ...state, winners: advanced, champion: advanced[0] ?? null };
    state = { entrants: advanced, winners: [], matchIndex: 0, round: state.round + 1, champion: null };
  }
  return state;
}

export function createTournament(ids: readonly string[]): Tournament {
  return settle({ entrants: [...ids], winners: [], matchIndex: 0, round: 1, champion: null });
}

export function currentMatch(t: Tournament): [string, string] | null {
  if (t.champion !== null) return null;
  const a = t.entrants[t.matchIndex * 2];
  const b = t.entrants[t.matchIndex * 2 + 1];
  return a !== undefined && b !== undefined ? [a, b] : null;
}

/** 같은 라운드의 다음 대결. 라운드 마지막 대결·결승이면 null (다음 라운드 대진은 아직 모름) */
export function upcomingMatch(t: Tournament): [string, string] | null {
  if (t.champion !== null) return null;
  const a = t.entrants[(t.matchIndex + 1) * 2];
  const b = t.entrants[(t.matchIndex + 1) * 2 + 1];
  return a !== undefined && b !== undefined ? [a, b] : null;
}

/** 현재 대결의 승자를 고른다. 부전승은 결과(result)로 나오지 않는다 */
export function pickWinner(
  t: Tournament,
  winner: string
): { tournament: Tournament; result: MatchResult | null } {
  const match = currentMatch(t);
  if (!match || !match.includes(winner)) return { tournament: t, result: null };
  const loser = match[0] === winner ? match[1] : match[0];
  const tournament = settle({ ...t, winners: [...t.winners, winner], matchIndex: t.matchIndex + 1 });
  return { tournament, result: { winner, loser } };
}

/** 라운드 시작 인원 → "32강" · 2명이면 "결승" */
export function roundLabel(entrantCount: number): string {
  return entrantCount === 2 ? "결승" : `${entrantCount}강`;
}

/** "32강 · 3/16" 에 쓰는 진행 정보 */
export function matchProgress(t: Tournament): { label: string; current: number; total: number } {
  return {
    label: roundLabel(t.entrants.length),
    current: t.matchIndex + 1,
    total: Math.floor(t.entrants.length / 2),
  };
}

/** 참가자 수 → 우승자가 나올 때까지의 라운드 수 */
export function roundCount(entrantCount: number): number {
  let rounds = 0;
  for (let n = entrantCount; n > 1; n = Math.ceil(n / 2)) rounds++;
  return rounds;
}

export type RankingEntry<T> = { photo: T; winCount: number };

/** worldcup_stats 결과 → 현재 전시 사진과 맞춘 랭킹 (목록에 없는 photo_id 는 건너뜀) */
export function buildWorldcupRanking<T extends { photoId: string }>(
  rows: unknown,
  photos: readonly T[],
  limit = 5
): RankingEntry<T>[] {
  if (!Array.isArray(rows)) return [];
  const byId = new Map(photos.map((photo) => [photo.photoId, photo]));
  const ranking: RankingEntry<T>[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { photo_id, win_count } = row as Record<string, unknown>;
    const photo = typeof photo_id === "string" ? byId.get(photo_id) : undefined;
    const winCount = typeof win_count === "string" ? Number(win_count) : win_count;
    if (!photo || typeof winCount !== "number" || !Number.isFinite(winCount) || winCount <= 0) continue;
    ranking.push({ photo, winCount });
    if (ranking.length >= limit) break;
  }
  return ranking;
}
