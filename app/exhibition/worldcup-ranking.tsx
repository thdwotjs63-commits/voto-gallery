"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ExhibitionPhoto } from "@/lib/exhibition";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";
import { buildWorldcupRanking, type RankingEntry } from "@/lib/worldcup";

type RankingState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: RankingEntry<ExhibitionPhoto>[] };

/** 전체 랭킹 TOP 5 — waitFor(이번 판 기록)가 끝난 뒤 불러온다 */
export default function WorldcupRanking({
  photos,
  waitFor,
}: {
  photos: ExhibitionPhoto[];
  waitFor: Promise<unknown>;
}) {
  const [state, setState] = useState<RankingState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<RankingState> => {
      if (!isSupabaseConfigured) return { status: "error" };
      await waitFor;
      const { data, error } = await supabase
        .from("worldcup_stats")
        .select("photo_id, win_count")
        .order("win_count", { ascending: false })
        .limit(5);
      if (error) return { status: "error" };
      return { status: "ready", entries: buildWorldcupRanking(data, photos) };
    };
    load()
      .catch((): RankingState => ({ status: "error" }))
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [photos, waitFor]);

  return (
    <section aria-labelledby="worldcup-ranking-title" className="rounded-3xl bg-white px-5 py-5 shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]">
      <h3 id="worldcup-ranking-title" className="text-lg font-extrabold">
        전체 랭킹 TOP 5
      </h3>
      <p className="mt-1 text-xs font-medium opacity-70">💛 지금까지 모인 선택을 모은 실시간 랭킹</p>

      {state.status === "loading" && (
        <p className="mt-4 text-sm opacity-60" role="status">
          랭킹을 불러오는 중…
        </p>
      )}
      {state.status === "error" && <p className="mt-4 text-sm opacity-70">랭킹을 불러오지 못했어요.</p>}
      {state.status === "ready" && state.entries.length === 0 && (
        <p className="mt-4 break-keep text-sm font-semibold">
          아직 집계된 선택이 없어요. 첫 월드컵의 주인공이 되어주세요!
        </p>
      )}
      {state.status === "ready" && state.entries.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {state.entries.map(({ photo, winCount }, index) => {
            const first = index === 0;
            return (
              <li
                key={photo.photoId}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${first ? "bg-[#FFF4D1] ring-2 ring-[#F7C331]" : ""}`}
              >
                <span className={`w-7 shrink-0 text-center font-extrabold tabular-nums ${first ? "text-xl" : "text-base opacity-70"}`}>
                  {first ? "👑" : index + 1}
                </span>
                <span className={`relative shrink-0 overflow-hidden rounded-xl bg-[#F3EEDF] ${first ? "h-16 w-16" : "h-12 w-12"}`}>
                  <Image src={photo.src} alt={`${index + 1}위 사진`} fill sizes="64px" quality={60} className="object-cover" />
                </span>
                <span className="ml-auto text-sm font-bold tabular-nums">
                  {winCount.toLocaleString("ko-KR")}표
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
