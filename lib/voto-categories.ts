export const VOTO_CATEGORIES = [
  { id: "hyundai", label: "현대건설", envKey: "VOTO_DRIVE_FOLDER_HYUNDAI" as const },
  { id: "team_korea", label: "팀코리아", envKey: "VOTO_DRIVE_FOLDER_TEAM_KOREA" as const },
  { id: "v_league", label: "브이리그", envKey: "VOTO_DRIVE_FOLDER_V_LEAGUE" as const },
  { id: "amateur", label: "실업배구", envKey: "VOTO_DRIVE_FOLDER_AMATEUR" as const },
] as const;

export type VotoCategoryId = (typeof VOTO_CATEGORIES)[number]["id"];

export const DEFAULT_VOTO_CATEGORY: VotoCategoryId = "hyundai";

export function isVotoCategoryId(value: string): value is VotoCategoryId {
  return VOTO_CATEGORIES.some((c) => c.id === value);
}
