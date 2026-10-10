"use client";

import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ExhibitionPhoto } from "@/lib/exhibition";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";
import {
  buildWorldcupRanking,
  DEFAULT_VOTER_GROUP,
  isSameRanking,
  type RankingEntry,
  type VoterGroup,
} from "@/lib/worldcup";

const DEFAULT_POLL_MS = 10_000;
/** 폴더에서 빠진 사진이 섞여 있어도 5개를 채우도록 넉넉히 읽는다 */
const FETCH_LIMIT = 10;
const MOVE_MS = 450;

type RankingState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: RankingEntry<ExhibitionPhoto>[] };

type Size = "default" | "large";

const STYLES: Record<
  Size,
  {
    section: string;
    title: string;
    caption: string;
    message: string;
    list: string;
    item: string;
    rank: [first: string, rest: string];
    thumb: [first: string, rest: string];
    thumbSizes: string;
    name: [first: string, rest: string];
    count: string;
  }
> = {
  default: {
    section: "rounded-3xl bg-white px-5 py-5 shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]",
    title: "text-lg font-extrabold",
    caption: "mt-1 text-xs font-medium opacity-70",
    message: "mt-4 text-sm",
    list: "mt-4 flex flex-col gap-3",
    item: "gap-3 rounded-2xl px-3 py-2",
    rank: ["w-7 text-xl", "w-7 text-base opacity-70"],
    thumb: ["h-16 w-16 rounded-xl", "h-12 w-12 rounded-xl"],
    thumbSizes: "64px",
    name: ["text-base", "text-sm"],
    count: "text-sm",
  },
  large: {
    section:
      "rounded-[2rem] bg-white px-4 py-6 shadow-[0_12px_36px_-16px_rgba(30,58,158,0.35)] md:px-10 md:py-9",
    title: "text-2xl font-extrabold md:text-3xl",
    caption: "mt-1.5 text-sm font-medium opacity-70 md:text-base",
    message: "mt-6 text-base md:text-xl",
    list: "mt-6 flex flex-col gap-3 md:gap-4",
    item: "gap-3 rounded-3xl px-2.5 py-2.5 md:gap-6 md:px-5 md:py-4",
    rank: ["w-8 text-2xl md:w-16 md:text-5xl", "w-8 text-xl opacity-70 md:w-16 md:text-4xl"],
    thumb: [
      "h-20 w-20 rounded-2xl md:h-36 md:w-36",
      "h-16 w-16 rounded-2xl md:h-28 md:w-28",
    ],
    thumbSizes: "(min-width: 768px) 144px, 80px",
    name: ["text-xl md:text-4xl", "text-lg md:text-3xl"],
    count: "text-lg md:text-3xl",
  },
};

async function fetchRanking(
  photos: ExhibitionPhoto[],
  group: VoterGroup
): Promise<RankingEntry<ExhibitionPhoto>[] | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("worldcup_stats")
    .select("photo_id, win_count")
    .eq("voter_group", group)
    .order("win_count", { ascending: false })
    .limit(FETCH_LIMIT);
  if (error) return null;
  return buildWorldcupRanking(data, photos);
}

/**
 * 전체 랭킹 TOP 5 — 실시간(기본 10초) 갱신.
 * waitFor(이번 판 기록)가 있으면 처음 한 번만 그걸 기다린 뒤 조회한다.
 * 탭이 숨겨지면 멈추고 다시 보이면 바로 한 번 조회 후 재개.
 */
export default function WorldcupRanking({
  photos,
  group = DEFAULT_VOTER_GROUP,
  waitFor,
  pollMs = DEFAULT_POLL_MS,
  size = "default",
}: {
  photos: ExhibitionPhoto[];
  /** 이 그룹(worldcup_stats.voter_group) 표만 집계 */
  group?: VoterGroup;
  waitFor?: Promise<unknown>;
  /** 0 이면 한 번만 조회 */
  pollMs?: number;
  size?: Size;
}) {
  const titleId = useId();
  const styles = STYLES[size];
  const [state, setState] = useState<RankingState>({ status: "loading" });
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const countRefs = useRef(new Map<string, HTMLSpanElement>());
  const previous = useRef(new Map<string, { top: number; winCount: number }>());

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let inFlight = false;
    let timer: number | undefined;

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      const entries = await fetchRanking(photos, group).catch(() => null);
      inFlight = false;
      if (cancelled) return;
      setState((prev) => {
        if (!entries) return prev.status === "ready" ? prev : { status: "error" };
        if (prev.status === "ready" && isSameRanking(prev.entries, entries)) return prev;
        return { status: "ready", entries };
      });
    };

    const stopPolling = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const startPolling = () => {
      if (pollMs <= 0 || timer !== undefined || document.visibilityState === "hidden") return;
      timer = window.setInterval(() => void refresh(), pollMs);
    };
    const onVisibilityChange = () => {
      if (!started || pollMs <= 0) return;
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        void refresh();
        startPolling();
      }
    };

    Promise.resolve(waitFor)
      .catch(() => undefined)
      .then(refresh)
      .then(() => {
        if (cancelled) return;
        started = true;
        startPolling();
      });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [photos, group, waitFor, pollMs]);

  /** 순위가 바뀐 줄은 이전 자리에서 미끄러지듯, 득표가 바뀐 숫자는 살짝 튀게 */
  useLayoutEffect(() => {
    if (state.status !== "ready") return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { top: number; winCount: number }>();
    for (const { photo, winCount } of state.entries) {
      const item = itemRefs.current.get(photo.photoId);
      if (!item) continue;
      const top = item.offsetTop;
      next.set(photo.photoId, { top, winCount });
      const before = previous.current.get(photo.photoId);
      if (!animate || previous.current.size === 0) continue;
      if (!before) {
        item.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: "ease-out" });
        continue;
      }
      if (before.top !== top) {
        item.animate([{ transform: `translateY(${before.top - top}px)` }, { transform: "translateY(0)" }], {
          duration: MOVE_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
      if (before.winCount !== winCount) {
        countRefs.current.get(photo.photoId)?.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.25)", color: "#E0A800" }, { transform: "scale(1)" }],
          { duration: 600, easing: "ease-out" }
        );
      }
    }
    previous.current = next;
  }, [state]);

  return (
    <section aria-labelledby={titleId} className={styles.section}>
      <h3 id={titleId} className={styles.title}>
        전체 랭킹 TOP 5
      </h3>
      <p className={styles.caption}>💛 지금까지 모인 선택을 모은 실시간 랭킹</p>

      {state.status === "loading" && (
        <p className={`${styles.message} opacity-60`} role="status">
          랭킹을 불러오는 중…
        </p>
      )}
      {state.status === "error" && <p className={`${styles.message} opacity-70`}>랭킹을 불러오지 못했어요.</p>}
      {state.status === "ready" && state.entries.length === 0 && (
        <p className={`${styles.message} break-keep font-semibold`}>
          아직 집계된 선택이 없어요. 첫 월드컵의 주인공이 되어주세요!
        </p>
      )}
      {state.status === "ready" && state.entries.length > 0 && (
        <ol className={styles.list} aria-live="polite">
          {state.entries.map(({ photo, winCount }, index) => {
            const first = index === 0;
            const pick = <T,>([firstValue, restValue]: [T, T]) => (first ? firstValue : restValue);
            return (
              <li
                key={photo.photoId}
                ref={(el) => {
                  if (el) itemRefs.current.set(photo.photoId, el);
                  else itemRefs.current.delete(photo.photoId);
                }}
                className={`relative flex items-center ${styles.item} ${first ? "bg-[#FFF4D1] ring-2 ring-[#F7C331]" : ""}`}
              >
                <span className={`shrink-0 text-center font-extrabold tabular-nums ${pick(styles.rank)}`}>
                  {first ? "👑" : index + 1}
                </span>
                <span className={`relative shrink-0 overflow-hidden bg-[#F3EEDF] ${pick(styles.thumb)}`}>
                  <Image src={photo.src} alt="" fill sizes={styles.thumbSizes} quality={60} className="object-cover" />
                </span>
                <span className={`line-clamp-2 min-w-0 flex-1 break-keep font-bold ${pick(styles.name)}`}>
                  {photo.name}
                </span>
                <span
                  ref={(el) => {
                    if (el) countRefs.current.set(photo.photoId, el);
                    else countRefs.current.delete(photo.photoId);
                  }}
                  className={`inline-block shrink-0 font-bold tabular-nums ${styles.count}`}
                >
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
