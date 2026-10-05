"use client";

import { useId, useState } from "react";
import { isMostlyKorean, translateToKorean } from "@/lib/translate";

/** 원문 → 번역. 목록을 다시 불러와 카드가 새로 그려져도 다시 호출하지 않는다 */
const translationCache = new Map<string, string>();

type Status = "idle" | "loading" | "shown" | "error";

export default function TranslatableMessage({ message }: { message: string }) {
  const blockId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [translation, setTranslation] = useState<string | null>(() => translationCache.get(message) ?? null);
  const canTranslate = !isMostlyKorean(message);

  const toggle = async () => {
    if (status === "loading") return;
    if (status === "shown") {
      setStatus("idle");
      return;
    }
    const cached = translation ?? translationCache.get(message);
    if (cached) {
      setTranslation(cached);
      setStatus("shown");
      return;
    }
    setStatus("loading");
    const result = await translateToKorean(message);
    if (!result) {
      setStatus("error");
      return;
    }
    translationCache.set(message, result);
    setTranslation(result);
    setStatus("shown");
  };

  return (
    <>
      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#1E2A55]">{message}</p>

      {canTranslate && (
        <>
          {status === "shown" && translation && (
            <div
              id={blockId}
              lang="ko"
              className="mt-3 rounded-xl border border-[#F7C331]/50 bg-[#FFF9E8] px-3 py-2.5 text-sm leading-relaxed text-[#1E2A55]/85"
            >
              <span className="mr-1.5 inline-block rounded-full bg-[#F7C331]/70 px-2 py-0.5 align-[1px] text-[11px] font-extrabold text-[#1E3A9E]">
                번역
              </span>
              <span className="whitespace-pre-wrap break-words">{translation}</span>
            </div>
          )}

          {status === "error" && (
            <p className="mt-2 text-xs text-[#A8431F]" role="status">
              번역을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          <button
            type="button"
            onClick={() => void toggle()}
            disabled={status === "loading"}
            aria-expanded={status === "shown"}
            aria-controls={status === "shown" ? blockId : undefined}
            className="-ml-2 mt-1.5 inline-flex min-h-8 items-center rounded-full px-2 text-xs font-bold text-[#1E3A9E]/70 transition-colors hover:bg-[#FFF4D1] hover:text-[#1E3A9E] disabled:cursor-wait"
          >
            {status === "loading" ? "번역 중..." : status === "shown" ? "원문 보기" : "🇰🇷 번역 보기"}
          </button>
        </>
      )}
    </>
  );
}
