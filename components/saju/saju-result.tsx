"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { Download, Heart, Share2 } from "lucide-react";
import type { CompatResult } from "@/lib/saju-compat";
import {
  MBTI_CHEMISTRY,
  matchCrossComment,
  type Mbti,
} from "@/lib/saju-mbti";
import type { ElementKey } from "@/lib/saju";
import { DAENI } from "@/lib/saju-compat";
import { STEM_KO, BRANCH_KO } from "@/lib/saju";

const ELEMENT_COLOR: Record<ElementKey, string> = {
  목: "#3E6C4F",
  화: "#7E3532",
  토: "#7A5F29",
  금: "#63676F",
  수: "#2B4363",
};

type Props = {
  result: CompatResult;
  mbti: Mbti | null;
  nickname: string;
  onReset: () => void;
};

export function SajuResult({ result, mbti, nickname, onReset }: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** 저장·공유 PNG에서 나의 사주·MBTI 제외 (화면에는 그대로 표시) */
  const [omitPrivateInImage, setOmitPrivateInImage] = useState(true);

  const chemistry = mbti ? MBTI_CHEMISTRY[mbti] : null;
  const cross = mbti ? matchCrossComment(result.summary, mbti) : null;
  const dayKo = `${STEM_KO[result.summary.dayStemIdx]}${BRANCH_KO[result.summary.dayBranchIdx]}`;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const capturePng = async () => {
    if (!cardRef.current) return null;
    await document.fonts.ready;
    return toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#131110",
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (!omitPrivateInImage) return true;
        return node.dataset.exportPrivate !== "true";
      },
    });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "daeni-gunghap.png";
      a.click();
    } catch {
      showToast("스크린샷으로 저장해주세요");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const dataUrl = await capturePng();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "daeni-gunghap.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "다인이와 궁합테스트",
            text: "다인이와 궁합테스트 결과 🏐 daeni.kr/saju",
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          throw err;
        }
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "daeni-gunghap.png";
        a.click();
        showToast("저장된 이미지를 공유해주세요");
      }
    } catch {
      showToast("스크린샷으로 저장해주세요");
    } finally {
      setBusy(false);
    }
  };

  const { summary } = result;

  return (
    <div className="space-y-4">
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl border border-[#D9C48A]/35 bg-[#131110] p-5 text-[#E9E3D6] sm:p-6"
      >
        {/* 낙관 도장 (일주 — 개인 사주) */}
        <div
          data-export-private="true"
          className="absolute right-4 top-4 flex h-14 w-14 rotate-[-8deg] items-center justify-center rounded-sm border-2 border-[#B83A2F] text-center text-[11px] font-bold leading-tight text-[#B83A2F]"
          style={{ fontFamily: "var(--font-saju-serif), serif" }}
          aria-hidden
        >
          {dayKo}
        </div>

        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#D9C48A]">
          DAENI × {nickname || "YOU"}
        </p>
        <h2
          className="mt-2 max-w-[85%] text-xl font-bold leading-snug text-[#E9E3D6] sm:text-2xl"
          style={{ fontFamily: "var(--font-saju-serif), serif" }}
        >
          {result.title}
        </h2>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <span className="text-4xl font-black tabular-nums text-[#D9C48A] sm:text-5xl">
              {result.score}
              <span className="ml-1 text-sm font-medium text-[#8A8172]">%</span>
            </span>
            <span className="mb-1 text-xs text-[#8A8172]">싱크로율</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#2A2520]">
            <div
              className="h-full rounded-full bg-[#D9C48A] transition-all"
              style={{ width: `${result.score}%` }}
            />
          </div>
        </div>

        <div data-export-private="true" className="mt-5">
          <p className="mb-2 text-[10px] tracking-wide text-[#8A8172]">나의 사주</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {summary.pillars.map((p) => (
              <div
                key={p.label}
                className="rounded-xl border border-[#2A2520] bg-[#1A1714] px-2 py-3 text-center"
              >
                <p className="text-[10px] text-[#8A8172]">{p.label}</p>
                <p
                  className="mt-1 text-lg text-[#E9E3D6]"
                  style={{ fontFamily: "var(--font-saju-serif), serif" }}
                >
                  {p.hanja}
                </p>
                <p className="text-[10px] text-[#6B645A]">{p.ko}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] tracking-wide text-[#8A8172]">다인 명식</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["연주", DAENI.pillars.year],
                ["월주", DAENI.pillars.month],
                ["일주", DAENI.pillars.day],
              ] as const
            ).map(([label, hanja]) => (
              <div
                key={label}
                className="rounded-xl border border-[#D9C48A]/20 bg-[#1A1714] px-2 py-3 text-center"
              >
                <p className="text-[10px] text-[#8A8172]">{label}</p>
                <p
                  className="mt-1 text-lg text-[#D9C48A]"
                  style={{ fontFamily: "var(--font-saju-serif), serif" }}
                >
                  {hanja}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div data-export-private="true" className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(summary.elements) as ElementKey[]).map((el) => (
            <span
              key={el}
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
              style={{ background: ELEMENT_COLOR[el] }}
            >
              {el} {summary.elements[el]}
            </span>
          ))}
        </div>

        {result.badges.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {result.badges.map((b) => (
              <span
                key={b.id}
                className="rounded-full border border-[#D9C48A]/40 px-2.5 py-1 text-[11px] text-[#D9C48A]"
              >
                {b.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-[#2A2520] bg-[#1A1714] p-4">
          <p className="text-[11px] font-semibold tracking-wide text-[#D9C48A]">일간 관계</p>
          <p className="mt-2 text-sm leading-relaxed text-[#E9E3D6]">{result.dayRelation}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#8A8172]">
            {result.dayRelationReverse}
          </p>
        </div>

        <div className="mt-3 space-y-1.5">
          {result.elementNotes.map((note) => (
            <p key={note} className="text-[12px] leading-relaxed text-[#C8C0B2]">
              · {note}
            </p>
          ))}
        </div>

        {chemistry ? (
          <div
            data-export-private="true"
            className="mt-4 rounded-xl border border-[#2A2520] bg-[#1A1714] p-4"
          >
            <p className="text-[11px] font-semibold tracking-wide text-[#8A8172]">
              인지기능 케미 · {mbti}
            </p>
            <p className="mt-1.5 text-[15px] font-semibold text-[#D9C48A]">{chemistry.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#E9E3D6]">{chemistry.text}</p>
          </div>
        ) : null}

        {cross ? (
          <div
            data-export-private="true"
            className="mt-4 rounded-xl border border-[#D9C48A]/25 bg-[#1A1714]/80 p-3.5"
          >
            <p className="text-[12px] leading-relaxed text-[#E9E3D6]">{cross}</p>
          </div>
        ) : null}

        {summary.nearTermBoundary ? (
          <p
            data-export-private="true"
            className="mt-4 text-[10px] leading-relaxed text-[#8A8172]"
          >
            절기 경계일 출생이라 정밀 만세력과 결과가 다를 수 있어요
          </p>
        ) : null}

        <p className="mt-4 text-center text-[10px] text-[#6B645A]">
          재미로 봐주세요 · 비공식 팬 콘텐츠 · 시주는 조만간 다인이에게 물어보고 추가할게요
        </p>
        <p className="mt-2 text-center text-[10px] tracking-wide text-[#8A8172]">
          daeni.kr/saju
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#2A2520] bg-[#1A1714]/80 px-3.5 py-3">
        <input
          type="checkbox"
          checked={omitPrivateInImage}
          onChange={(e) => setOmitPrivateInImage(e.target.checked)}
          className="mt-0.5 accent-[#D9C48A]"
        />
        <span className="text-[12px] leading-relaxed text-[#C8C0B2]">
          <span className="font-medium text-[#D9C48A]">저장·공유 시 개인 정보 가리기</span>
          <span className="mt-0.5 block text-[#8A8172]">
            나의 사주·오행·MBTI는 화면에는 보이고, 이미지에는 넣지 않아요. (기본 켜짐)
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#D9C48A]/50 py-3 text-sm font-semibold text-[#D9C48A] transition hover:bg-[#D9C48A]/10 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          이미지 저장
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleShare}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#D9C48A] py-3 text-sm font-bold text-[#131110] transition hover:bg-[#E3D09A] disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          공유하기
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/?guestbook=1")}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D9C48A]/30 bg-[#1A1714] py-3 text-sm font-semibold text-[#E9E3D6] transition hover:border-[#D9C48A]/60 hover:bg-[#221E1A]"
      >
        <Heart className="h-4 w-4 text-[#D9C48A]" />
        방명록
      </button>

      <button
        type="button"
        onClick={onReset}
        className="w-full py-2 text-xs text-[#8A8172] underline-offset-2 hover:underline"
      >
        다시 하기
      </button>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#E9E3D6] px-4 py-2 text-xs font-medium text-[#131110] shadow-lg sm:bottom-8">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
