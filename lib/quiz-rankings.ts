import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";

export type QuizRankingEntry = {
  id: string;
  nickname: string;
  timeMs: number;
  createdAt: number;
};

type QuizRankingRow = {
  id: string;
  nickname: string;
  time_ms: number;
  created_at: string;
};

function mapRow(row: QuizRankingRow): QuizRankingEntry {
  return {
    id: row.id,
    nickname: row.nickname,
    timeMs: row.time_ms,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Fastest runs first; `created_at` breaks ties (earlier submission ranks higher). */
export async function fetchQuizTopRankings(limit = 5): Promise<QuizRankingEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("quiz_rankings")
    .select("id,nickname,time_ms,created_at")
    .order("time_ms", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[quiz_rankings] fetch failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapRow(row as QuizRankingRow));
}

export async function insertQuizRanking(
  nickname: string,
  timeMs: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Supabase가 설정되지 않았습니다." };
  }

  const timeMsInt = Math.floor(timeMs);
  if (!Number.isFinite(timeMsInt) || timeMsInt < 0) {
    return { ok: false, message: "기록 시간이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요." };
  }

  const { error } = await supabase.from("quiz_rankings").insert({
    nickname: nickname.slice(0, 14),
    time_ms: timeMsInt,
  });

  if (error) {
    console.error("[quiz_rankings] insert failed:", error.code, error.message, error.details);

    const msg = error.message ?? "";
    if (msg.includes("does not exist") || msg.includes("Could not find the table")) {
      return {
        ok: false,
        message:
          "DB에 quiz_rankings 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations의 퀴즈 마이그레이션을 실행해 주세요.",
      };
    }
    if (
      error.code === "42501" ||
      msg.toLowerCase().includes("permission denied") ||
      msg.toLowerCase().includes("row-level security")
    ) {
      return {
        ok: false,
        message:
          "DB 권한 때문에 저장되지 않았습니다. quiz_rankings에 대한 GRANT·RLS INSERT 정책을 확인하고, supabase/migrations/20260202130000_quiz_rankings_grants.sql 을 실행해 보세요.",
      };
    }
    if (msg.includes("violates check constraint")) {
      return { ok: false, message: "닉네임 길이(1~14자) 또는 기록 시간 제한을 만족하지 않습니다." };
    }

    return {
      ok: false,
      message: `기록 저장에 실패했습니다. (${error.code ?? "unknown"}) 잠시 후 다시 시도해 주세요.`,
    };
  }

  return { ok: true };
}
