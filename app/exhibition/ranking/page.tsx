import type { Metadata } from "next";
import Link from "next/link";
import { getWorldcupPhotos, type ExhibitionPhoto } from "@/lib/exhibition";
import { SITE_URL } from "@/lib/seo-metadata";
import WorldcupRanking from "../worldcup-ranking";

export const revalidate = 300;

const TITLE = "봉드컵 실시간 랭킹 | 생일 기념";
const DESCRIPTION = "지금 이 순간 봉드컵 TOP 5. 팬들이 고른 최고의 김다인 사진을 실시간으로 확인하세요.";
const OG_IMAGE = `${SITE_URL.replace(/\/$/, "")}/hero.jpg`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/exhibition/ranking" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/exhibition/ranking",
    siteName: "daeni.kr",
    type: "website",
    locale: "ko_KR",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "배구선수 김다인" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

async function loadPhotos(): Promise<ExhibitionPhoto[]> {
  try {
    return await getWorldcupPhotos();
  } catch (error) {
    console.error("[exhibition/ranking] drive fetch failed", error);
    return [];
  }
}

/** 커피차·전시 현장 큰 화면에 띄워 두는 실시간 랭킹 전광판 */
export default async function WorldcupRankingPage() {
  const photos = await loadPhotos();

  return (
    <main className="min-h-dvh bg-[#FFFBF0] pb-[calc(3rem+env(safe-area-inset-bottom))] text-[#1E3A9E]">
      <div className="mx-auto w-full max-w-[960px] px-4 pt-10 md:px-8 md:pt-16">
        <header className="text-center">
          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-6xl">
            <span className="bg-[linear-gradient(transparent_62%,#F7C331_62%)] px-1">봉드컵 실시간 랭킹</span> 🏐
          </h1>
          <p className="mt-3 text-base font-semibold opacity-75 md:mt-4 md:text-2xl">
            현대건설배구단이 생각하는 최고의 김다인은?
          </p>
        </header>

        <div className="mt-8 md:mt-12">
          <WorldcupRanking photos={photos} size="large" />
        </div>

        <footer className="mt-10 flex flex-col items-center gap-4 md:mt-14">
          <Link
            href="/exhibition"
            className="inline-flex min-h-14 items-center rounded-full bg-[#F7C331] px-8 text-lg font-extrabold text-[#1E3A9E] shadow-[0_10px_24px_-10px_rgba(247,195,49,0.9)] transition-transform active:scale-[0.98] md:min-h-16 md:px-10 md:text-2xl"
          >
            봉드컵 참여하러 가기 →
          </Link>
          <p className="text-xs font-medium opacity-60 md:text-sm">10초마다 자동으로 새로고침돼요</p>
        </footer>
      </div>
    </main>
  );
}
