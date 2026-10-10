import { describe, expect, it } from "vitest";
import {
  buildWorldcupRanking,
  createTournament,
  currentMatch,
  isSameRanking,
  matchProgress,
  pickWinner,
  pickWorldcupEntrants,
  roundCount,
  shuffle,
  upcomingMatch,
  worldcupMatchParams,
  worldcupSize,
  type MatchResult,
  type Tournament,
} from "./worldcup";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** 항상 위쪽(첫 번째) 사진을 고르며 끝까지 진행 */
function playOut(start: Tournament) {
  let t = start;
  const results: MatchResult[] = [];
  const rounds = new Set<number>();
  for (let guard = 0; guard < 1000; guard++) {
    const match = currentMatch(t);
    if (!match) break;
    rounds.add(t.round);
    const next = pickWinner(t, match[0]);
    if (next.result) results.push(next.result);
    t = next.tournament;
  }
  return { final: t, results, rounds: rounds.size };
}

describe("worldcupSize", () => {
  it("uses the biggest power of two from 4 up to 32", () => {
    expect(worldcupSize(40)).toBe(32);
    expect(worldcupSize(32)).toBe(32);
    expect(worldcupSize(20)).toBe(16);
    expect(worldcupSize(12)).toBe(8);
    expect(worldcupSize(4)).toBe(4);
    expect(worldcupSize(3)).toBeNull();
  });

  it("takes entrants from the front of the order", () => {
    expect(pickWorldcupEntrants(ids(20))).toEqual(ids(16));
    expect(pickWorldcupEntrants(ids(3))).toEqual([]);
  });
});

describe("tournament", () => {
  it.each([
    [32, 5, "32강", 16],
    [16, 4, "16강", 8],
    [8, 3, "8강", 4],
  ])("%i photos play %i rounds", (n, rounds, label, firstRoundMatches) => {
    const start = createTournament(ids(n));
    expect(matchProgress(start)).toEqual({ label, current: 1, total: firstRoundMatches });
    expect(roundCount(n)).toBe(rounds);

    const { final, results, rounds: played } = playOut(start);
    expect(played).toBe(rounds);
    expect(results).toHaveLength(n - 1);
    expect(final.champion).toBe("p1");
  });

  it("calls the last two the final", () => {
    let t = createTournament(ids(4));
    t = pickWinner(t, "p1").tournament;
    t = pickWinner(t, "p4").tournament;
    expect(currentMatch(t)).toEqual(["p1", "p4"]);
    expect(matchProgress(t)).toEqual({ label: "결승", current: 1, total: 1 });
  });

  it("gives the odd one out a bye without recording a match", () => {
    let t = createTournament(ids(5));
    expect(matchProgress(t).total).toBe(2);

    t = pickWinner(t, "p1").tournament;
    const second = pickWinner(t, "p3");
    t = second.tournament;
    expect(second.result).toEqual({ winner: "p3", loser: "p4" });
    // p5 는 대결 없이 다음 라운드로
    expect(t.round).toBe(2);
    expect(t.entrants).toEqual(["p1", "p3", "p5"]);

    const { final, results } = playOut(t);
    expect(final.champion).toBe("p1");
    expect(results.flatMap((r) => [r.winner, r.loser])).not.toContain(undefined);
    expect(results).toHaveLength(2);
  });

  it("ends with exactly one champion", () => {
    for (const n of [2, 3, 5, 7, 8, 13, 32]) {
      const { final, results } = playOut(createTournament(ids(n)));
      expect(final.champion).not.toBeNull();
      expect(ids(n)).toContain(final.champion);
      expect(results).toHaveLength(n - 1);
      expect(currentMatch(final)).toBeNull();
    }
    expect(createTournament(["solo"]).champion).toBe("solo");
  });

  it("previews the next match only within the same round", () => {
    let t = createTournament(ids(8));
    expect(upcomingMatch(t)).toEqual(["p3", "p4"]);
    t = pickWinner(t, "p1").tournament;
    t = pickWinner(t, "p3").tournament;
    expect(upcomingMatch(t)).toEqual(["p7", "p8"]);
    t = pickWinner(t, "p5").tournament;
    // 8강 마지막 대결: 다음 라운드 대진은 아직 모름
    expect(upcomingMatch(t)).toBeNull();
    t = pickWinner(t, "p7").tournament;
    expect(upcomingMatch(t)).toEqual(["p5", "p7"]);
    t = pickWinner(t, "p1").tournament;
    t = pickWinner(t, "p5").tournament;
    // 결승
    expect(upcomingMatch(t)).toBeNull();
  });

  it("ignores a pick that is not in the current match", () => {
    const t = createTournament(ids(4));
    expect(pickWinner(t, "p3")).toEqual({ tournament: t, result: null });
  });
});

describe("shuffle", () => {
  it("keeps every item and does not touch the input", () => {
    const input = ids(32);
    const out = shuffle(input, () => 0.42);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual(ids(32));
  });
});

describe("buildWorldcupRanking", () => {
  const photos = ids(3).map((photoId) => ({ photoId }));

  it("matches photo ids and skips unknown or empty rows", () => {
    expect(
      buildWorldcupRanking(
        [
          { photo_id: "gone", win_count: 99 },
          { photo_id: "p2", win_count: 7 },
          { photo_id: "p1", win_count: "3" },
          { photo_id: "p3", win_count: 0 },
        ],
        photos
      )
    ).toEqual([
      { photo: { photoId: "p2" }, winCount: 7 },
      { photo: { photoId: "p1" }, winCount: 3 },
    ]);
    expect(buildWorldcupRanking(null, photos)).toEqual([]);
  });
});

describe("worldcupMatchParams", () => {
  const result = { winner: "p1", loser: "p2" };

  it("sends the voter group as grp", () => {
    expect(worldcupMatchParams(result, "fan")).toEqual({ winner: "p1", loser: "p2", grp: "fan" });
    expect(worldcupMatchParams(result, "player")).toEqual({ winner: "p1", loser: "p2", grp: "player" });
  });

  it("falls back to player when no group is given", () => {
    expect(worldcupMatchParams(result).grp).toBe("player");
  });
});

describe("isSameRanking", () => {
  const p = (photoId: string, winCount: number) => ({ photo: { photoId }, winCount });

  it("is true only when order and counts both match", () => {
    expect(isSameRanking([p("a", 3), p("b", 1)], [p("a", 3), p("b", 1)])).toBe(true);
    expect(isSameRanking([], [])).toBe(true);
    expect(isSameRanking([p("a", 3), p("b", 1)], [p("a", 4), p("b", 1)])).toBe(false);
    expect(isSameRanking([p("a", 3), p("b", 3)], [p("b", 3), p("a", 3)])).toBe(false);
    expect(isSameRanking([p("a", 3)], [p("a", 3), p("b", 1)])).toBe(false);
  });
});
