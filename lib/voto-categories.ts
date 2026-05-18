export const VOTO_CATEGORIES = [
  {
    id: "hyundai",
    label: "현대건설",
    envKeys: ["VOTO_DRIVE_FOLDER_HYUNDAI"] as const,
  },
  {
    id: "team_korea",
    label: "팀코리아",
    envKeys: ["VOTO_DRIVE_FOLDER_TEAM_KOREA"] as const,
  },
  {
    id: "women_volleyball",
    label: "여자배구",
    envKeys: ["VOTO_DRIVE_FOLDER_V_LEAGUE", "VOTO_DRIVE_FOLDER_AMATEUR"] as const,
  },
] as const;

export type VotoCategoryId = (typeof VOTO_CATEGORIES)[number]["id"];

/** 예전 URL 호환: 브이리그·실업배구 → 여자배구 */
const LEGACY_CATEGORY_ALIASES: Record<string, VotoCategoryId> = {
  v_league: "women_volleyball",
  amateur: "women_volleyball",
};

export const DEFAULT_VOTO_CATEGORY: VotoCategoryId = "hyundai";

export function isVotoCategoryId(value: string): value is VotoCategoryId {
  return VOTO_CATEGORIES.some((c) => c.id === value);
}

export function normalizeVotoCategoryId(value: string): VotoCategoryId | null {
  const trimmed = value.trim();
  if (isVotoCategoryId(trimmed)) return trimmed;
  return LEGACY_CATEGORY_ALIASES[trimmed] ?? null;
}

/** Voto Photo 카테고리별 공유·바로가기 URL (기본 카테고리는 `/voto`) */
export function getVotoCategoryUrl(categoryId: VotoCategoryId): string {
  if (categoryId === DEFAULT_VOTO_CATEGORY) {
    return "/voto";
  }
  return `/voto/${categoryId}`;
}

export function parseVotoCategoryFromPathSegment(segment: string): VotoCategoryId | null {
  const decoded = decodeURIComponent(segment.trim());
  return normalizeVotoCategoryId(decoded);
}

export function getVotoCategoryEnvKeys(categoryId: VotoCategoryId): readonly string[] {
  return VOTO_CATEGORIES.find((c) => c.id === categoryId)?.envKeys ?? [];
}

export function getVotoCategoryLabel(categoryId: VotoCategoryId): string {
  return VOTO_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}
