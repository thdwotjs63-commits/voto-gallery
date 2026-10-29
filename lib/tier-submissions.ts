import { findRosterPlayer, TIER_TEAMS, type TierTeamId } from "./players-roster";
import { isSupabaseConfigured, supabase } from "./supabase-client";
import type { TierParticipantDraft, TierPickMap, TierTitleKind } from "./tier-chart";

/** DB picks jsonb: { "현대건설": "3 김다인", ... } — 텅 칸 생략 */
export type TierSubmissionPicks = Partial<Record<TierTeamId, string>>;

export function buildTierSubmissionPicks(picks: TierPickMap): TierSubmissionPicks {
  const out: TierSubmissionPicks = {};
  for (const team of TIER_TEAMS) {
    const no = picks[team.id];
    if (no == null) continue;
    const player = findRosterPlayer(team.id, no);
    if (!player) continue;
    out[team.id] = `${player.no} ${player.name}`;
  }
  return out;
}

type TierSubmissionRow = {
  nickname: string;
  tier_type: TierTitleKind;
  picks: TierSubmissionPicks;
};

/** 이미지 저장 시 조용히 upsert. 실패해도 throw 하지 않음. */
export async function upsertTierSubmissions(
  titleKind: TierTitleKind,
  participants: readonly TierParticipantDraft[]
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const rows: TierSubmissionRow[] = [];
  for (const p of participants) {
    const nickname = p.nickname.trim().slice(0, 20);
    if (!nickname) continue;
    rows.push({
      nickname,
      tier_type: titleKind,
      picks: buildTierSubmissionPicks(p.picks),
    });
  }
  if (rows.length === 0) return;

  try {
    const { error } = await supabase.from("tier_submissions").upsert(rows, {
      onConflict: "nickname,tier_type",
    });
    if (error) {
      console.error("[tier_submissions] upsert failed:", error.code, error.message);
    }
  } catch (err) {
    console.error("[tier_submissions] upsert threw:", err);
  }
}
