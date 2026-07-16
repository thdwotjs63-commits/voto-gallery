"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SajuForm, type SajuFormValues } from "@/components/saju/saju-form";
import { SajuResult } from "@/components/saju/saju-result";
import { computeCompat, type CompatResult } from "@/lib/saju-compat";
import type { Mbti } from "@/lib/saju-mbti";

export function SajuClient() {
  const [result, setResult] = useState<CompatResult | null>(null);
  const [mbti, setMbti] = useState<Mbti | null>(null);
  const [nickname, setNickname] = useState("");

  const handleSubmit = (values: SajuFormValues) => {
    setResult(computeCompat(values.birth));
    setMbti(values.mbti);
    setNickname(values.nickname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    setResult(null);
    setMbti(null);
    setNickname("");
  };

  return (
    <div className="min-h-screen bg-[#131110] text-[#E9E3D6] [color-scheme:dark]">
      <SiteNav />
      <main className="mx-auto max-w-lg px-5 pb-28 pt-8 sm:px-6 sm:pb-12">
        <header className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#D9C48A]">
            DAENI.KR
          </p>
          <h1
            className="mt-2 text-2xl font-bold leading-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-saju-serif), serif" }}
          >
            다인이와 궁합테스트
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8A8172]">
            생년월일로 보는 나와 다인이의 사주 케미.
            <br />
            입력 정보는 어디에도 저장되지 않아요.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-xs text-[#8A8172] underline-offset-2 hover:text-[#D9C48A] hover:underline"
          >
            ← 갤러리로
          </Link>
        </header>

        {result ? (
          <SajuResult
            result={result}
            mbti={mbti}
            nickname={nickname}
            onReset={handleReset}
          />
        ) : (
          <SajuForm onSubmit={handleSubmit} />
        )}
      </main>
    </div>
  );
}
