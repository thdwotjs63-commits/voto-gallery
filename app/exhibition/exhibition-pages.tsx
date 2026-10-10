import type { Metadata } from "next";
import Link from "next/link";
import { getWorldcupPhotos, type ExhibitionPhoto } from "@/lib/exhibition";
import { SITE_URL } from "@/lib/seo-metadata";
import { pickWorldcupEntrants, WORLDCUP_QUESTION, type VoterGroup } from "@/lib/worldcup";
import Worldcup from "./worldcup";
import WorldcupRanking from "./worldcup-ranking";

const OG_IMAGE = `${SITE_URL.replace(/\/$/, "")}/hero.jpg`;

export function exhibitionMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "daeni.kr",
      type: "website",
      locale: "ko_KR",
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "배구선수 김다인" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

async function loadWorldcupPhotos(): Promise<ExhibitionPhoto[]> {
  try {
    return await getWorldcupPhotos();
  } catch (error) {
    console.error("[exhibition] drive fetch failed", error);
    return [];
  }
}

/** 봉드컵 본편 — 그룹마다 기록·랭킹이 따로 쌓인다 */
export async function WorldcupPage({ group }: { group: VoterGroup }) {
  const photos = await loadWorldcupPhotos();

  return (
    <main className="min-h-dvh bg-[#FFFBF0] pb-[calc(3rem+env(safe-area-inset-bottom))] text-[#1E3A9E]">
      <div className="mx-auto w-full max-w-[480px] px-4">
        <Worldcup entrants={pickWorldcupEntrants(photos)} photos={photos} group={group} />

        <footer className="mt-14 flex flex-col items-center gap-4">
          <Link
            href="/birthday"
            className="inline-flex min-h-14 w-full max-w-[360px] items-center justify-center rounded-full border-2 border-[#1E3A9E] bg-[#F7C331] px-7 text-center text-lg font-extrabold break-keep text-[#1E3A9E] shadow-[0_12px_28px_-12px_rgba(30,58,158,0.55)] transition-transform active:scale-[0.98]"
          >
            💌 다인이에게 생일 축하 메시지 남기기
          </Link>
          <Link href="/" className="text-sm font-semibold opacity-70 underline-offset-4 hover:underline">
            ← 홈으로
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** 커피차·전시 현장 큰 화면에 띄워 두는 실시간 랭킹 전광판 */
export async function RankingBoardPage({
  group,
  title,
  joinHref,
  joinLabel,
}: {
  group: VoterGroup;
  title: string;
  joinHref: string;
  joinLabel: string;
}) {
  const photos = await loadWorldcupPhotos();

  return (
    <main className="min-h-dvh bg-[#FFFBF0] pb-[calc(3rem+env(safe-area-inset-bottom))] text-[#1E3A9E]">
      <div className="mx-auto w-full max-w-[960px] px-4 pt-10 md:px-8 md:pt-16">
        <header className="text-center">
          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-6xl">
            <span className="bg-[linear-gradient(transparent_62%,#F7C331_62%)] px-1">{title}</span> 🏐
          </h1>
          <p className="mt-3 text-base font-semibold opacity-75 md:mt-4 md:text-2xl">{WORLDCUP_QUESTION[group]}</p>
        </header>

        <div className="mt-8 md:mt-12">
          <WorldcupRanking photos={photos} group={group} size="large" />
        </div>

        <footer className="mt-10 flex flex-col items-center gap-4 md:mt-14">
          <Link
            href={joinHref}
            className="inline-flex min-h-14 items-center rounded-full bg-[#F7C331] px-8 text-lg font-extrabold text-[#1E3A9E] shadow-[0_10px_24px_-10px_rgba(247,195,49,0.9)] transition-transform active:scale-[0.98] md:min-h-16 md:px-10 md:text-2xl"
          >
            {joinLabel}
          </Link>
          <p className="text-xs font-medium opacity-60 md:text-sm">10초마다 자동으로 새로고침돼요</p>
        </footer>
      </div>
    </main>
  );
}
