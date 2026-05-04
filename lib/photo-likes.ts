import type { SupabaseClient } from "@supabase/supabase-js";

const IN_CHUNK = 120;

/**
 * Google Drive file id → `photo_likes.photo_id`와 동일한 문자열을 사용해야
 * 갤러리 목록이 바뀌어도 누적 하트가 같은 파일에 매핑됩니다.
 */
export function normalizePhotoLikeId(driveFileId: string): string {
  return driveFileId.trim();
}

function emptyCountsMap(photoIds: string[]): Record<string, number> {
  return Object.fromEntries(photoIds.map((id) => [id, 0]));
}

async function fetchLikeCountsFallback(
  supabase: SupabaseClient,
  photoIds: string[],
  base: Record<string, number>
): Promise<Record<string, number>> {
  const out = { ...base };
  for (let i = 0; i < photoIds.length; i += IN_CHUNK) {
    const chunk = photoIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase.from("photo_likes").select("photo_id").in("photo_id", chunk);
    if (error) {
      console.error("[photo-likes] fallback chunk failed:", error.message);
      return out;
    }
    for (const row of (data ?? []) as { photo_id: string }[]) {
      const pid = normalizePhotoLikeId(row.photo_id);
      if (pid in out) out[pid] = (out[pid] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * 갤러리에 보이는 `photo_id`(= Drive file id)별 누적 하트 수.
 * 가능하면 RPC로 DB에서 집계해 행 수 제한 없이 정확한 카운트를 가져옵니다.
 */
export async function fetchPhotoLikeCounts(
  supabase: SupabaseClient,
  rawPhotoIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(rawPhotoIds.map(normalizePhotoLikeId).filter(Boolean))];
  if (unique.length === 0) return {};

  const base = emptyCountsMap(unique);

  const { data: rpcRows, error: rpcError } = await supabase.rpc("photo_like_counts_for_ids", {
    p_ids: unique,
  });

  if (!rpcError && rpcRows != null) {
    const out = { ...base };
    for (const row of rpcRows as { photo_id: string; like_count: number | string }[]) {
      const pid = normalizePhotoLikeId(String(row.photo_id));
      if (!Object.prototype.hasOwnProperty.call(out, pid)) continue;
      const n = typeof row.like_count === "string" ? Number(row.like_count) : row.like_count;
      out[pid] = Number.isFinite(n) ? n : 0;
    }
    return out;
  }

  if (rpcError) {
    console.warn("[photo-likes] RPC unavailable, using row scan:", rpcError.message);
  }

  return fetchLikeCountsFallback(supabase, unique, base);
}
