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
  upcomingMatch,
  type MatchResult,
  type Tournament,
} from "@/lib/worldcup";
import { saveCardImage, type SaveCardResult } from "./save-card-image";
import WorldcupRanking from "./worldcup-ranking";
import "./exhibition.css";

const PICK_ANIMATION_MS = 380;
const BATTLE_SIZES = "(max-width: 480px) 50vw, 224px";
const RESULT_SIZES = "(max-width: 480px) 100vw, 448px";
const CARD_FILE_NAME = "봉드컵_PICK.png";

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
  const upcoming = tournament ? upcomingMatch(tournament) : null;
  const upcomingA = upcoming ? byId.get(upcoming[0]) : undefined;
  const upcomingB = upcoming ? byId.get(upcoming[1]) : undefined;

  useEffect(() => {
    preloadPhoto(upcomingA);
    preloadPhoto(upcomingB);
  }, [upcomingA, upcomingB]);

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
      <section className="pt-8" aria-labelledby="worldcup-title">
        <WorldcupTitle />
        <p className="mt-8 rounded-3xl bg-white px-6 py-10 text-center font-bold shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]">
          월드컵 준비 중입니다
        </p>
      </section>
    );
  }

  const champion = tournament?.champion ? byId.get(tournament.champion) : undefined;

  return (
    <section ref={sectionRef} className="scroll-mt-0 pt-8" aria-labelledby="worldcup-title">
      <WorldcupTitle />
      {!tournament && (
        <div className="pt-8">
          <div className="flex flex-col items-center gap-2">
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
          nextNames={upcomingA && upcomingB ? [upcomingA.name, upcomingB.name] : null}
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

function WorldcupTitle() {
  return (
    <header className="text-center">
      <h1 id="worldcup-title" className="text-[2.75rem] leading-none font-black tracking-tight">
        <span className="bg-[linear-gradient(transparent_65%,#F7C331_65%)] px-1">봉드컵</span>
      </h1>
      <p className="mt-3 break-keep text-base font-bold opacity-80">
        현대건설배구단이 생각하는 최고의 김다인은?
      </p>
    </header>
  );
}

function BattleView({
  tournament,
  photos,
  nextNames,
  picked,
  onChoose,
  onQuit,
}: {
  tournament: Tournament;
  photos: [ExhibitionPhoto | undefined, ExhibitionPhoto | undefined];
  /** 같은 라운드의 다음 대결 (없으면 null) */
  nextNames: [string, string] | null;
  picked: string | null;
  onChoose: (photoId: string) => void;
  onQuit: () => void;
}) {
  const progress = matchProgress(tournament);
  return (
    <div className="flex flex-col gap-5 pt-5">
      <div className="text-center">
        <div className="relative">
          <p className="text-lg font-extrabold tabular-nums" aria-live="polite">
            {progress.label} · {progress.current}/{progress.total}
          </p>
          <button
            type="button"
            onClick={onQuit}
            className="absolute top-1/2 right-0 -translate-y-1/2 text-xs font-semibold opacity-60 underline-offset-4 hover:underline"
          >
            처음으로
          </button>
        </div>
        {nextNames && (
          <p className="mx-auto mt-3 flex max-w-full w-fit items-center rounded-full bg-[#FFF4D1] px-4 py-1.5 text-xs font-semibold ring-1 ring-[#F7C331]/70">
            <span className="truncate">
              다음 대결: {nextNames[0]} vs {nextNames[1]}
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) =>
          photo ? (
            <button
              key={photo.photoId}
              type="button"
              onClick={() => onChoose(photo.photoId)}
              disabled={picked !== null}
              data-state={picked === null ? undefined : picked === photo.photoId ? "picked" : "dropped"}
              aria-label={`${photo.name} 선택`}
              className={`worldcup-choice flex min-w-0 flex-col rounded-3xl bg-white p-2 text-left shadow-[0_12px_28px_-14px_rgba(30,58,158,0.4)] outline-offset-4 disabled:cursor-default ${
                picked === photo.photoId ? "ring-4 ring-[#F7C331]" : ""
              }`}
            >
              <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#F3EEDF]">
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes={BATTLE_SIZES}
                  quality={60}
                  loading="eager"
                  className="object-cover object-[50%_25%]"
                />
              </span>
              <span className="my-2 flex min-h-10 items-center justify-center px-1">
                <span className="line-clamp-2 text-center text-sm leading-5 font-bold break-keep">{photo.name}</span>
              </span>
              <span className="mt-auto flex min-h-11 items-center justify-center rounded-full bg-[#1E3A9E] text-base font-extrabold text-white">
                선택
              </span>
            </button>
          ) : null
        )}
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
            alt={`나의 우승 사진: ${champion.name}`}
            width={champion.width || 1200}
            height={champion.height || 1600}
            sizes={RESULT_SIZES}
            quality={75}
            loading="eager"
            crossOrigin="anonymous"
            onError={() => setImageFailed(true)}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
        {champion.name && (
          <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 22, fontWeight: 800, wordBreak: "keep-all" }}>
            {champion.name}
          </p>
        )}
        <p style={{ margin: "8px 0 2px", textAlign: "center", fontSize: 15, fontWeight: 700 }}>
          봉드컵 · 나의 PICK 🏐
        </p>
        <p style={{ margin: 0, textAlign: "center", fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
          Happy Bong&apos;s Day
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
