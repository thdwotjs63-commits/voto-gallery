"use client";

import Image, { getImageProps } from "next/image";
import { Download, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ExhibitionPhoto } from "@/lib/exhibition";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";
import {
  createTournament,
  currentMatch,
  matchProgress,
  pickWinner,
  roundLabel,
  shuffle,
  type MatchResult,
  type Tournament,
} from "@/lib/worldcup";
import { saveCardImage, type SaveCardResult } from "./save-card-image";
import WorldcupRanking from "./worldcup-ranking";

const PICK_ANIMATION_MS = 380;
const BATTLE_SIZES = "(max-width: 480px) 100vw, 448px";
const CARD_FILE_NAME = "다인이_사진월드컵_PICK.png";

async function recordMatch({ winner, loser }: MatchResult): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.rpc("record_worldcup_match", { winner, loser });
    if (error) console.error("[worldcup] record failed", error);
  } catch (error) {
    console.error("[worldcup] record failed", error);
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function preloadPhoto(photo: ExhibitionPhoto | undefined) {
  if (!photo) return;
  const { props } = getImageProps({ src: photo.src, alt: "", fill: true, sizes: BATTLE_SIZES, quality: 60 });
  const img = new window.Image();
  if (props.sizes) img.sizes = props.sizes;
  if (props.srcSet) img.srcset = props.srcSet;
  img.src = props.src;
}

export default function Worldcup({
  entrants,
  photos,
}: {
  /** 순번 앞에서 고른 4·8·16·32장 (4장 미만이면 빈 배열) */
  entrants: ExhibitionPhoto[];
  /** 랭킹 매칭용 전체 전시 사진 */
  photos: ExhibitionPhoto[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [game, setGame] = useState(0);
  const [rankingWait, setRankingWait] = useState<Promise<unknown> | null>(null);
  const records = useRef<Promise<void>[]>([]);
  const timer = useRef<number | undefined>(undefined);

  const byId = useMemo(() => new Map(entrants.map((photo) => [photo.photoId, photo])), [entrants]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const match = tournament ? currentMatch(tournament) : null;

  useEffect(() => {
    if (!tournament || tournament.champion !== null) return;
    const next = (tournament.matchIndex + 1) * 2;
    preloadPhoto(byId.get(tournament.entrants[next]));
    preloadPhoto(byId.get(tournament.entrants[next + 1]));
  }, [tournament, byId]);

  const scrollToTop = () => {
    sectionRef.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const start = () => {
    window.clearTimeout(timer.current);
    records.current = [];
    setPicked(null);
    setRankingWait(null);
    setGame((n) => n + 1);
    setTournament(createTournament(shuffle(entrants.map((photo) => photo.photoId))));
    scrollToTop();
  };

  const choose = (photoId: string) => {
    if (!tournament || picked) return;
    const { tournament: next, result } = pickWinner(tournament, photoId);
    if (!result) return;
    records.current.push(recordMatch(result));

    const advance = () => {
      setPicked(null);
      setTournament(next);
      if (next.champion !== null) {
        setRankingWait(Promise.allSettled(records.current));
        scrollToTop();
      }
    };
    if (prefersReducedMotion()) {
      advance();
      return;
    }
    setPicked(photoId);
    timer.current = window.setTimeout(advance, PICK_ANIMATION_MS);
  };

  if (entrants.length === 0) {
    return (
      <section className="pt-12">
        <WorldcupIntro />
        <p className="mt-6 rounded-3xl bg-white px-6 py-10 text-center font-bold shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]">
          월드컵 준비 중입니다
        </p>
      </section>
    );
  }

  const champion = tournament?.champion ? byId.get(tournament.champion) : undefined;

  return (
    <section ref={sectionRef} className="scroll-mt-0 pt-6" aria-label="다인이 사진 월드컵">
      {!tournament && (
        <div className="pt-6">
          <WorldcupIntro />
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={start}
              className="inline-flex min-h-13 items-center rounded-full bg-[#F7C331] px-10 text-lg font-extrabold text-[#1E3A9E] shadow-[0_10px_24px_-10px_rgba(30,58,158,0.45)] transition-transform active:scale-[0.97]"
            >
              시작하기
            </button>
            <p className="text-xs font-semibold opacity-70">
              {roundLabel(entrants.length)} · 사진 {entrants.length}장
            </p>
          </div>
        </div>
      )}

      {tournament && match && (
        <BattleView
          tournament={tournament}
          photos={[byId.get(match[0]), byId.get(match[1])]}
          picked={picked}
          onChoose={choose}
          onQuit={() => {
            window.clearTimeout(timer.current);
            setPicked(null);
            setTournament(null);
          }}
        />
      )}

      {champion && rankingWait && (
        <ResultView key={game} champion={champion} onRestart={start}>
          <WorldcupRanking photos={photos} waitFor={rankingWait} />
        </ResultView>
      )}
    </section>
  );
}

function WorldcupIntro() {
  return (
    <header className="text-center">
      <h1 className="break-keep text-[2rem] font-extrabold leading-tight tracking-tight">
        <span className="bg-[linear-gradient(transparent_62%,#F7C331_62%)] px-1">다인이 사진 월드컵 🏐</span>
      </h1>
      <p className="mt-3 break-keep text-sm font-semibold opacity-80">둘 중 더 마음에 드는 사진을 골라주세요</p>
      <div className="mt-6 rounded-3xl border border-[#F7C331]/60 bg-white px-5 py-4 text-left text-sm leading-relaxed break-keep shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]">
        <p className="font-bold">마음에 드는 사진을 많이 많이 골라주세요 💛</p>
        <p className="mt-1 opacity-80">이 자료는 &apos;다인듀스101&apos;의 참고자료로 쓰입니다.</p>
        <p className="mt-1 opacity-80">즐감해주세요~</p>
      </div>
    </header>
  );
}

function BattleView({
  tournament,
  photos,
  picked,
  onChoose,
  onQuit,
}: {
  tournament: Tournament;
  photos: [ExhibitionPhoto | undefined, ExhibitionPhoto | undefined];
  picked: string | null;
  onChoose: (photoId: string) => void;
  onQuit: () => void;
}) {
  const progress = matchProgress(tournament);
  return (
    <div className="flex h-[calc(100svh-2.5rem)] max-h-[860px] min-h-[480px] flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className="rounded-full bg-[#1E3A9E] px-4 py-1.5 text-sm font-extrabold text-white tabular-nums" aria-live="polite">
          {progress.label} · {progress.current}/{progress.total}
        </p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1E3A9E]/10" aria-hidden>
          <div
            className="h-full rounded-full bg-[#F7C331] transition-[width] duration-300"
            style={{ width: `${((progress.current - 1) / progress.total) * 100}%` }}
          />
        </div>
        <button type="button" onClick={onQuit} className="shrink-0 text-xs font-semibold opacity-60 underline-offset-4 hover:underline">
          처음으로
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-3">
        {photos.map((photo, index) =>
          photo ? (
            <button
              key={photo.photoId}
              type="button"
              onClick={() => onChoose(photo.photoId)}
              disabled={picked !== null}
              data-state={picked === null ? undefined : picked === photo.photoId ? "picked" : "dropped"}
              aria-label={index === 0 ? "위 사진 고르기" : "아래 사진 고르기"}
              className="worldcup-choice relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-[#F3EEDF] shadow-[0_12px_28px_-14px_rgba(30,58,158,0.4)] outline-offset-4 disabled:cursor-default"
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes={BATTLE_SIZES}
                quality={60}
                loading="eager"
                className="object-cover object-[50%_30%]"
              />
              {picked === photo.photoId && (
                <span className="absolute inset-0 rounded-3xl ring-4 ring-inset ring-[#F7C331]" aria-hidden />
              )}
            </button>
          ) : null
        )}
        <span
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#FFFBF0] bg-[#F7C331] text-sm font-black text-[#1E3A9E] shadow-md"
          aria-hidden
        >
          VS
        </span>
      </div>
    </div>
  );
}

function ResultView({
  champion,
  onRestart,
  children,
}: {
  champion: ExhibitionPhoto;
  onRestart: () => void;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveCardResult | null>(null);

  const save = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    setSaveResult(await saveCardImage(cardRef.current, CARD_FILE_NAME));
    setSaving(false);
  };

  const showLongPressHint = imageFailed || saveResult === "failed";

  return (
    <div className="worldcup-result-in flex flex-col gap-6 pt-4">
      <h2 className="text-center text-2xl font-extrabold">👑 당신의 우승 사진</h2>

      <div
        ref={cardRef}
        style={{
          background: "#FFFBF0",
          border: "3px solid #F7C331",
          borderRadius: 28,
          padding: 14,
          color: "#1E3A9E",
        }}
      >
        <div style={{ borderRadius: 18, overflow: "hidden", background: "#F3EEDF" }}>
          <Image
            src={champion.src}
            alt="나의 우승 사진"
            width={champion.width || 1200}
            height={champion.height || 1600}
            sizes={BATTLE_SIZES}
            quality={75}
            loading="eager"
            crossOrigin="anonymous"
            onError={() => setImageFailed(true)}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
        <p style={{ margin: "14px 0 2px", textAlign: "center", fontSize: 18, fontWeight: 800 }}>
          다인이 사진 월드컵 · 나의 PICK 🏐
        </p>
        <p style={{ margin: 0, textAlign: "center", fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
          No.3 김다인 · 생일 기념
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-3">
          {!imageFailed && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#1E3A9E] px-6 font-bold text-white shadow-[0_10px_24px_-10px_rgba(30,58,158,0.6)] transition-transform active:scale-[0.97] disabled:opacity-70"
            >
              <Download aria-hidden className="h-4 w-4" />
              {saving ? "만드는 중…" : "이미지 저장"}
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#1E3A9E]/20 bg-white px-6 font-bold transition-transform active:scale-[0.97]"
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            다시 하기
          </button>
        </div>
        <p className="min-h-5 text-center text-sm font-semibold break-keep" role="status">
          {showLongPressHint && "사진을 길게 눌러 저장해주세요"}
          {saveResult === "blocked" && "팝업이 차단되어 있어요. 팝업을 허용한 뒤 다시 시도해 주세요."}
          {saveResult === "opened" && "새 탭에서 이미지를 길게 눌러 저장해주세요"}
          {saveResult === "saved" && "이미지를 저장했어요 💛"}
        </p>
      </div>

      {children}
    </div>
  );
}
