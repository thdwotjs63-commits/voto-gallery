"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { driveLh3S1000Url, type DriveImage } from "@/lib/drive-gallery-data";
import { trackGaEvent } from "@/lib/analytics";
import { fetchQuizTopRankings, insertQuizRanking, type QuizRankingEntry } from "@/lib/quiz-rankings";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";

type QuizKind = "place" | "away-date" | "home-date";

type QuizQuestion = {
  id: string;
  kind: QuizKind;
  photo: DriveImage;
  prompt: string;
  answer: string;
  choices: string[];
};

const HOME_PLACE = "수원실내체육관";
const TOTAL_QUESTIONS = 10;

const QUIZ_SHARE_BODY =
  "[Voto Gallery] 김다인 선수 사진 퀴즈 도전! 당신의 찐팬 지수는 몇 점? #현대건설배구단 #김다인";

function getQuizPageUrl(): string {
  if (typeof window === "undefined") return "";
  return new URL("/quiz", window.location.origin).href;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizePlace(image: DriveImage): string {
  return image.locationTag?.replace(/^#/, "").trim() || "장소 미표기";
}

function normalizeDate(image: DriveImage): string {
  return (image.scheduleDisplay || image.folderName || "").trim() || "일정 미표기";
}

function extractYearDateOnly(text: string): string {
  const six = text.match(/\b(\d{6})\b/);
  if (six) return six[1];

  const eight = text.match(/\b(19\d{2}|20\d{2})[.\-/ ]?(\d{2})[.\-/ ]?(\d{2})\b/);
  if (eight) {
    return `${eight[1].slice(2)}${eight[2]}${eight[3]}`;
  }

  return text;
}

function formatTime(ms: number): string {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function makeThreeChoices(answer: string, pool: string[]): string[] | null {
  const wrong = shuffle(pool.filter((item) => item !== answer));
  if (wrong.length < 2) return null;
  return shuffle([answer, wrong[0], wrong[1]]);
}

function buildQuestions(photos: DriveImage[]): QuizQuestion[] | null {
  const uniquePlaces = [...new Set(photos.map(normalizePlace).filter(Boolean))];
  const awayPhotos = photos.filter((photo) => normalizePlace(photo) !== HOME_PLACE);
  const homePhotos = photos.filter((photo) => normalizePlace(photo) === HOME_PLACE);
  const awayDates = [...new Set(awayPhotos.map(normalizeDate).filter(Boolean))];
  const homeDates = [...new Set(homePhotos.map(normalizeDate).filter(Boolean))];

  if (uniquePlaces.length < 3 || awayDates.length < 3 || homeDates.length < 3) {
    return null;
  }

  const usedPhotoIds = new Set<string>();
  const questions: QuizQuestion[] = [];

  const pushQuestions = (
    count: number,
    candidates: DriveImage[],
    kind: QuizKind,
    prompt: string,
    answerGetter: (photo: DriveImage) => string,
    wrongPool: string[]
  ) => {
    for (const photo of shuffle(candidates)) {
      if (questions.length >= TOTAL_QUESTIONS) break;
      if (usedPhotoIds.has(photo.id)) continue;
      if (questions.filter((q) => q.kind === kind).length >= count) break;
      const answer = answerGetter(photo);
      const choices = makeThreeChoices(answer, wrongPool);
      if (!choices) continue;
      usedPhotoIds.add(photo.id);
      questions.push({
        id: `${kind}-${photo.id}`,
        kind,
        photo,
        prompt,
        answer,
        choices,
      });
    }
  };

  pushQuestions(4, photos, "place", "이 사진의 장소는 어디일까요?", normalizePlace, uniquePlaces);
  pushQuestions(
    2,
    awayPhotos,
    "away-date",
    "원정 경기 날짜를 맞혀보세요.",
    normalizeDate,
    awayDates
  );
  pushQuestions(
    4,
    homePhotos,
    "home-date",
    "수원 홈 경기 날짜를 맞혀보세요.",
    normalizeDate,
    homeDates
  );

  const placeCount = questions.filter((q) => q.kind === "place").length;
  const awayCount = questions.filter((q) => q.kind === "away-date").length;
  const homeCount = questions.filter((q) => q.kind === "home-date").length;

  if (placeCount < 4 || awayCount < 2 || homeCount < 4 || questions.length !== TOTAL_QUESTIONS) {
    return null;
  }

  const ordered: QuizQuestion[] = [];
  ordered.push(...shuffle(questions.filter((q) => q.kind === "place")).slice(0, 4));
  ordered.push(...shuffle(questions.filter((q) => q.kind === "away-date")).slice(0, 2));
  ordered.push(...shuffle(questions.filter((q) => q.kind === "home-date")).slice(0, 4));
  return ordered;
}

function ScoreBoard({
  ranking,
  loading,
  emptyHint,
}: {
  ranking: QuizRankingEntry[];
  loading: boolean;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1f2937] bg-black p-4 shadow-[0_0_20px_rgba(255,210,0,0.2)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-[#FFD200]">Score Board</h3>
        <span className="font-mono text-[11px] text-cyan-300/80">TOP 5</span>
      </div>
      <ol className="space-y-2 font-mono text-sm">
        {loading ? (
          <li className="rounded bg-zinc-900 px-3 py-2 text-center text-cyan-300/75">불러오는 중…</li>
        ) : ranking.length === 0 ? (
          <li className="rounded bg-zinc-900 px-3 py-2 text-center text-cyan-300/75">
            {emptyHint ?? "아직 기록이 없습니다."}
          </li>
        ) : (
          ranking.map((entry, idx) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded bg-zinc-900 px-3 py-2"
            >
              <span className="text-cyan-300">
                #{idx + 1} {entry.nickname}
              </span>
              <span className="text-[#FFD200]">{formatTime(entry.timeMs)}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

export function PhotoQuizGame({ photos }: { photos: DriveImage[] }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(() => buildQuestions(photos));

  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [nickname, setNickname] = useState("");
  const [ranking, setRanking] = useState<QuizRankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(isSupabaseConfigured);
  const [saved, setSaved] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const autoNextTimerRef = useRef<number | null>(null);
  const shareToastTimerRef = useRef<number | null>(null);
  const previousQuestionSignatureRef = useRef<string | null>(null);
  const hallOfFameRef = useRef<HTMLDivElement | null>(null);
  const rankingReloadTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const signatureOf = (set: QuizQuestion[]) => set.map((q) => q.id).join("|");

  const reloadRankings = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isSupabaseConfigured) {
      setRanking([]);
      setRankingLoading(false);
      return;
    }
    if (!opts?.silent) {
      setRankingLoading(true);
    }
    const rows = await fetchQuizTopRankings(5);
    if (!mountedRef.current) return;
    setRanking(rows);
    setRankingLoading(false);
  }, []);

  const scheduleRankingReload = useCallback(() => {
    if (rankingReloadTimerRef.current) {
      window.clearTimeout(rankingReloadTimerRef.current);
    }
    rankingReloadTimerRef.current = window.setTimeout(() => {
      rankingReloadTimerRef.current = null;
      void reloadRankings({ silent: true });
    }, 220);
  }, [reloadRankings]);

  const generateQuestionSet = () => {
    const previousSignature = previousQuestionSignatureRef.current;
    let candidate: QuizQuestion[] | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const next = buildQuestions(photos);
      if (!next) return null;
      candidate = next;
      if (!previousSignature || signatureOf(next) !== previousSignature) {
        break;
      }
    }
    return candidate;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rankingReloadTimerRef.current) {
        window.clearTimeout(rankingReloadTimerRef.current);
      }
      if (shareToastTimerRef.current) {
        window.clearTimeout(shareToastTimerRef.current);
      }
    };
  }, []);

  const handleShareQuiz = useCallback(async () => {
    setShareToast(null);
    if (shareToastTimerRef.current) {
      window.clearTimeout(shareToastTimerRef.current);
      shareToastTimerRef.current = null;
    }

    const url = getQuizPageUrl();
    const clipboardText = url ? `${QUIZ_SHARE_BODY}\n${url}` : QUIZ_SHARE_BODY;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Voto Gallery 사진 퀴즈",
          text: QUIZ_SHARE_BODY,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(clipboardText);
      setShareToast("공유 문구와 링크를 복사했어요.");
    } catch {
      setShareToast("복사에 실패했어요. 주소창의 /quiz 링크를 직접 보내 주세요.");
    }

    shareToastTimerRef.current = window.setTimeout(() => {
      setShareToast(null);
      shareToastTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    void reloadRankings();
  }, [reloadRankings]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel("quiz-rankings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_rankings" },
        () => {
          scheduleRankingReload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scheduleRankingReload]);

  useEffect(() => {
    const next = buildQuestions(photos);
    setQuestions(next);
    previousQuestionSignatureRef.current = null;
  }, [photos]);

  useEffect(() => {
    if (phase !== "playing" || startAt === null) return;
    const timerId = window.setInterval(() => {
      setElapsedMs(Math.max(0, Math.floor(performance.now() - startAt)));
    }, 33);
    return () => window.clearInterval(timerId);
  }, [phase, startAt]);

  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        window.clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  if (!questions) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          🏐
        </p>
        <h1 className="text-2xl font-bold text-[#00287A]">퀴즈 문제를 만들 수 없어요</h1>
        <p className="text-sm leading-relaxed text-[#00287A]/85">
          장소/날짜 데이터가 충분하지 않아 10문제(3지선다) 구성을 완료하지 못했습니다.
        </p>
        <Link
          href="/"
          className="rounded-full border-2 border-[#00287A] bg-[#FFD200] px-6 py-2.5 text-sm font-semibold text-[#00287A] shadow-[0_6px_16px_rgba(0,40,122,0.18)] transition hover:opacity-95"
        >
          갤러리로 돌아가기
        </Link>
      </main>
    );
  }

  const current = questions?.[questionIndex];

  const startGame = () => {
    trackGaEvent("quiz_start", { location: "quiz_intro" });
    if (autoNextTimerRef.current) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    const nextQuestions = generateQuestionSet();
    if (!nextQuestions) return;
    setQuestions(nextQuestions);
    previousQuestionSignatureRef.current = signatureOf(nextQuestions);
    setPhase("playing");
    setQuestionIndex(0);
    setSelectedChoice(null);
    setFeedback(null);
    setElapsedMs(0);
    setSaved(false);
    setSaveError(null);
    setSaveSubmitting(false);
    setShowHallOfFame(false);
    setFinalTimeMs(null);
    setCorrectCount(0);
    setStartAt(performance.now());
  };

  const onPickChoice = (choice: string) => {
    if (phase !== "playing" || selectedChoice !== null || !current) return;
    const isCorrect = choice === current.answer;
    setSelectedChoice(choice);
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
    }

    autoNextTimerRef.current = window.setTimeout(() => {
      const lastQuestion = questionIndex >= (questions?.length ?? 0) - 1;
      if (lastQuestion) {
        const doneAt = startAt === null ? elapsedMs : Math.max(0, Math.floor(performance.now() - startAt));
        setFinalTimeMs(doneAt);
        setElapsedMs(doneAt);
        setPhase("finished");
        setStartAt(null);
      } else {
        setQuestionIndex((idx) => idx + 1);
        setSelectedChoice(null);
        setFeedback(null);
      }
    }, 520);
  };

  const submitRanking = async () => {
    if (finalTimeMs === null || saved || saveSubmitting || correctCount !== TOTAL_QUESTIONS) return;
    const trimmed = nickname.trim();
    if (!trimmed) return;

    setSaveError(null);
    setSaveSubmitting(true);
    try {
      const result = await insertQuizRanking(trimmed, finalTimeMs);
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      setSaved(true);
      await reloadRankings({ silent: true });
    } finally {
      setSaveSubmitting(false);
    }
  };

  const canSaveHallOfFame = correctCount === TOTAL_QUESTIONS;
  const useDateOnlyForCurrentQuestion = current && questionIndex >= 7 && current.kind === "home-date";
  const displayChoice = (choice: string) =>
    useDateOnlyForCurrentQuestion ? extractYearDateOnly(choice) : choice;

  const rankingEmptyHint = !isSupabaseConfigured
    ? "Supabase(NEXT_PUBLIC_SUPABASE_URL 등) 설정 후 전역 랭킹이 표시됩니다."
    : undefined;

  const openHallOfFame = () => {
    setShowHallOfFame(true);
    window.setTimeout(() => {
      hallOfFameRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#00287A]/15 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00287A]/60">Time Attack</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#00287A]">사진 퀴즈 10선</h1>
            <button
              type="button"
              onClick={openHallOfFame}
              className="rounded-full border border-[#00287A]/30 bg-white px-3 py-1 text-xs font-semibold text-[#00287A] transition hover:bg-[#00287A]/5"
            >
              명예의 전당 바로가기
            </button>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-full border border-[#00287A]/30 bg-white px-4 py-2 text-xs font-semibold text-[#00287A] transition hover:bg-[#00287A]/5"
        >
          갤러리로 돌아가기
        </Link>
      </header>

      <section className="mb-6 rounded-2xl border-2 border-[#00287A]/20 bg-[#00287A] px-4 py-3 text-center shadow-[0_8px_22px_rgba(0,40,122,0.2)]">
        <p className="font-mono text-3xl font-bold tracking-wider text-[#FFD200] sm:text-4xl">{formatTime(elapsedMs)}</p>
        <p className="mt-1 text-xs font-medium text-white/80">시작 버튼부터 10문제 완료까지 실시간 기록</p>
      </section>

      {phase === "ready" && (
        <section className="rounded-2xl border-2 border-[#00287A]/20 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#00287A]/85">총 10문제 / 3지선다 / 후반부 난이도 상승</p>
          <ul className="mt-4 space-y-1 text-sm text-[#00287A]/75">
            <li>1~4번: 장소 맞추기</li>
            <li>5~6번: 원정 날짜 맞추기</li>
            <li>7~10번: 수원 홈 날짜 맞추기</li>
          </ul>
          <div className="mt-6 flex flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={startGame}
              className="min-h-11 touch-manipulation rounded-full border-2 border-[#00287A] bg-[#FFD200] px-6 py-3 text-sm font-bold text-[#00287A] shadow-[0_8px_18px_rgba(0,40,122,0.15)] transition hover:-translate-y-0.5 sm:px-8"
            >
              타임어택 시작
            </button>
            <button
              type="button"
              onClick={() => void handleShareQuiz()}
              className="min-h-11 touch-manipulation rounded-full border-2 border-[#00287A] bg-white px-5 py-3 text-sm font-semibold text-[#00287A] shadow-sm transition hover:bg-[#00287A]/[0.04] hover:shadow-md sm:px-6"
            >
              퀴즈 공유하기 🔗
            </button>
          </div>
          {shareToast ? (
            <p className="mt-3 text-center text-xs font-medium text-[#00287A]/85" role="status">
              {shareToast}
            </p>
          ) : null}
        </section>
      )}

      {phase !== "ready" && current && (
        <section className="space-y-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#00287A]/80">
            <p>
              문제 {questionIndex + 1} / {TOTAL_QUESTIONS}
            </p>
            <p>
              {questionIndex < 4 ? "장소 라운드" : questionIndex < 6 ? "원정 날짜 라운드" : "홈 날짜 라운드"}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-[#00287A]/20 bg-[#00287A]/[0.03] shadow-inner">
            <div className="relative aspect-[4/3] w-full bg-zinc-100">
              <Image
                src={driveLh3S1000Url(current.photo.id)}
                alt="Quiz Image"
                title=""
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 48rem"
                priority={questionIndex === 0}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#00287A]/15 bg-white p-4">
            <h2 className="text-base font-bold text-[#00287A]">{current.prompt}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {current.choices.map((choice) => {
                const isSelected = selectedChoice === choice;
                const isAnswer = current.answer === choice;
                let className = "border-[#00287A]/20 bg-white text-[#00287A] hover:border-[#00287A]/45";

                if (selectedChoice !== null) {
                  if (isAnswer) {
                    className = "border-emerald-500 bg-emerald-50 text-emerald-800";
                  } else if (isSelected) {
                    className = "border-rose-500 bg-rose-50 text-rose-700";
                  } else {
                    className = "border-zinc-200 bg-zinc-50 text-zinc-400";
                  }
                }

                return (
                  <li key={choice}>
                    <button
                      type="button"
                      disabled={phase !== "playing" || selectedChoice !== null}
                      onClick={() => onPickChoice(choice)}
                      className={`min-h-[3.25rem] w-full rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${className}`}
                    >
                      {displayChoice(choice)}
                    </button>
                  </li>
                );
              })}
            </ul>

            {feedback && (
              <p
                className={`mt-4 text-center text-sm font-bold ${feedback === "correct" ? "text-emerald-700" : "text-rose-700"}`}
                role="status"
              >
                {feedback === "correct" ? "정답! 다음 문제로 이동합니다." : "오답! 다음 문제로 이동합니다."}
              </p>
            )}
          </div>
        </section>
      )}

      {showHallOfFame && phase !== "finished" && (
        <section className="mt-8" ref={hallOfFameRef}>
          <ScoreBoard ranking={ranking} loading={rankingLoading} emptyHint={rankingEmptyHint} />
        </section>
      )}

      {phase === "finished" && finalTimeMs !== null && (
        <section className="mt-8 space-y-5">
          <div className="rounded-2xl border-2 border-[#00287A]/25 bg-[#FFD200]/35 p-5 text-center">
            <p className="text-sm font-semibold text-[#00287A]/80">최종 기록</p>
            <p className="mt-1 font-mono text-4xl font-extrabold text-[#00287A]">{formatTime(finalTimeMs)}</p>
            <p className="mt-2 text-sm font-semibold text-[#00287A]">
              정답 {correctCount} / {TOTAL_QUESTIONS}
            </p>

            <div className="mx-auto mt-5 flex max-w-sm gap-2">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={14}
                placeholder={
                  canSaveHallOfFame && isSupabaseConfigured
                    ? "닉네임 (최대 14자)"
                    : canSaveHallOfFame
                      ? "Supabase 설정 후 등록 가능"
                      : "10문제를 모두 맞추면 저장할 수 있어요"
                }
                disabled={!canSaveHallOfFame || !isSupabaseConfigured}
                className="h-10 flex-1 rounded-xl border border-[#00287A]/30 px-3 text-sm text-[#00287A] outline-none ring-[#00287A] placeholder:text-[#00287A]/40 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => void submitRanking()}
                disabled={saved || saveSubmitting || !canSaveHallOfFame || !isSupabaseConfigured}
                className="h-10 rounded-xl bg-[#00287A] px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saved ? "저장됨" : saveSubmitting ? "저장 중…" : "명예의 전당 등록"}
              </button>
            </div>
            {saveError ? <p className="mt-2 text-xs font-semibold text-rose-600">{saveError}</p> : null}
            {!canSaveHallOfFame && (
              <p className="mt-2 text-xs font-semibold text-[#00287A]/80">
                명예의 전당은 10문제 전부 정답일 때만 등록됩니다.
              </p>
            )}
            {canSaveHallOfFame && !isSupabaseConfigured ? (
              <p className="mt-2 text-xs font-semibold text-[#00287A]/80">
                서버 랭킹을 쓰려면 Supabase 환경 변수와 DB 마이그레이션을 적용해 주세요.
              </p>
            ) : null}

            <button
              type="button"
              onClick={startGame}
              className="mt-4 rounded-full border border-[#00287A] bg-white px-5 py-2 text-xs font-semibold text-[#00287A] transition hover:bg-[#00287A]/5"
            >
              다시 도전
            </button>
          </div>

          <div ref={hallOfFameRef}>
            <ScoreBoard ranking={ranking} loading={rankingLoading} emptyHint={rankingEmptyHint} />
          </div>
        </section>
      )}
    </div>
  );
}
