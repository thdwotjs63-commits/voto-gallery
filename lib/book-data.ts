/** 생일 메시지북 데이터 — 서버 전용 */

import { BoothBlobConfigError, privateBlobGetText, privateBlobPutJson } from "@/lib/booth-blob";
import { isBookMessageId, type BookMessage } from "@/lib/book-pages";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type BookAdminMessage = BookMessage & { is_public: boolean };

const HIDDEN_IDS_PATH = "book/hidden-message-ids.json";
const SUPABASE_PAGE_SIZE = 1000;
export const BOOK_HIDDEN_IDS_MAX = 5000;

/** 비공개 메시지까지 읽어야 해서 service role 키가 꼭 필요하다 */
export async function loadAllBirthdayMessages(): Promise<BookAdminMessage[]> {
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = getSupabaseServerClient();
  const rows: BookAdminMessage[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("birthday_messages")
      .select("id, nickname, message, created_at, is_public")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`birthday_messages select failed: ${error.message}`);
    rows.push(...((data ?? []) as BookAdminMessage[]));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

export async function loadHiddenMessageIds(scope: string): Promise<string[]> {
  const text = await privateBlobGetText(scope, HIDDEN_IDS_PATH);
  if (!text) return [];
  const parsed: unknown = JSON.parse(text);
  const ids = Array.isArray(parsed) ? parsed : [];
  return ids.filter(isBookMessageId);
}

/**
 * 책 화면용. 운영에서는 숨김 목록을 못 읽으면 실패시켜 숨긴 메시지가 새지 않게 한다.
 * 개발 환경에서만 Blob 설정이 없으면 빈 목록으로 본다.
 */
export async function loadHiddenMessageIdsForBook(scope: string): Promise<string[]> {
  try {
    return await loadHiddenMessageIds(scope);
  } catch (error) {
    if (process.env.NODE_ENV === "development" && error instanceof BoothBlobConfigError) {
      console.warn(`[${scope}] hidden ids unavailable in dev, showing all: ${error.message}`);
      return [];
    }
    throw error;
  }
}

export async function saveHiddenMessageIds(scope: string, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.filter(isBookMessageId))].slice(0, BOOK_HIDDEN_IDS_MAX);
  await privateBlobPutJson(scope, HIDDEN_IDS_PATH, unique);
  return unique;
}

/** 개발 환경 레이아웃 확인용 가짜 메시지 (?demo=N) */
export function buildDemoMessages(count: number): BookMessage[] {
  const samples = [
    "다인 선수 생일 축하해요! 늘 응원합니다 💛",
    "코트 위에서 빛나는 다인 선수, 올해도 다치지 말고 행복한 한 해 보내세요.",
    "처음 경기장에서 다인 선수 토스를 보고 팬이 됐어요. 그때부터 지금까지 매 경기 챙겨보고 있어요. 아시안게임에서 태극마크 달고 뛰는 모습 보면서 정말 자랑스러웠습니다. 앞으로도 지금처럼 즐겁게 배구해 주세요. 생일 진심으로 축하드려요!",
    "HAPPY BIRTHDAY 🎂\n\n늘 고마워요\n늘 응원해요\n늘 사랑해요",
  ];
  const start = Date.parse("2026-10-04T03:00:00Z");
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    nickname: `팬${i + 1}`,
    message: i % 7 === 6 ? "가나다라마바사 ".repeat(60).trim().slice(0, 500) : samples[i % samples.length],
    created_at: new Date(start + i * 37 * 60 * 1000).toISOString(),
  }));
}
