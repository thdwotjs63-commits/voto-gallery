export type SeasonStat = {
  season: string;
  games: number;
  points: number;
  attackSuccess: number;
  serve: number;
  block: number;
  dig: number;
  set: number;
  errors: number;
};

// 김다인 시즌별 누적 기록 (출처: 네이버 스포츠). 새 시즌 끝나면 맨 위에 한 줄 추가.
export const SEASON_STATS: SeasonStat[] = [
  { season: "2025-2026", games: 34, points: 54, attackSuccess: 20.75, serve: 0.21, block: 0.10, dig: 3.33, set: 10.96, errors: 41 },
  { season: "2024-2025", games: 35, points: 38, attackSuccess: 27.66, serve: 0.13, block: 0.06, dig: 2.99, set: 10.82, errors: 53 },
  { season: "2023-2024", games: 35, points: 65, attackSuccess: 30.77, serve: 0.23, block: 0.13, dig: 2.82, set: 11.67, errors: 51 },
  { season: "2022-2023", games: 36, points: 57, attackSuccess: 20.27, serve: 0.16, block: 0.14, dig: 3.18, set: 11.02, errors: 65 },
  { season: "2021-2022", games: 31, points: 40, attackSuccess: 21.62, serve: 0.22, block: 0.06, dig: 2.48, set: 10.53, errors: 48 },
  { season: "2020-2021", games: 30, points: 31, attackSuccess: 23.40, serve: 0.12, block: 0.07, dig: 2.79, set: 9.88, errors: 50 },
  { season: "2019-2020", games: 3, points: 0, attackSuccess: 0.00, serve: 0.00, block: 0.00, dig: 2.40, set: 7.00, errors: 2 },
  { season: "2017-2018", games: 3, points: 2, attackSuccess: 0.00, serve: 0.29, block: 0.00, dig: 2.29, set: 7.57, errors: 3 },
];

// 통산 누적 (네이버 표의 "통산" 행)
export const CAREER_TOTAL = {
  games: 207,
  points: 287,
  attackSuccess: 23.64,
  set: 10.80,
  setSuccessRate: 39.8,
  setAttempts: 3721,
  setSuccess: 1480,
  digSuccessRate: 84.4,
};
