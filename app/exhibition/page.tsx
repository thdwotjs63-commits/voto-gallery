import type { Metadata } from "next";
import Link from "next/link";
import { getWorldcupPhotos, type ExhibitionPhoto } from "@/lib/exhibition";
import { SITE_URL } from "@/lib/seo-metadata";
import { pickWorldcupEntrants } from "@/lib/worldcup";
import Worldcup from "./worldcup";

export const revalidate = 300;

const TITLE = "봉드컵 | 생일 기념";
const DESCRIPTION = "둘 중 더 마음에 드는 사진을 골라주세요. No.3 김다인 선수 생일 기념 봉드컵.";
const OG_IMAGE = `${SITE_URL.replace(/\/$/, "")}/hero.jpg`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/exhibition" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/exhibition",
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

async function loadExhibitionPhotos(): Promise<ExhibitionPhoto[]> {
  try {
    return await getWorldcupPhotos();
  } catch (error) {
    console.error("[exhibition] drive fetch failed", error);
    return [];
  }
}

export default async function ExhibitionPage() {
  const photos = await loadExhibitionPhotos();

  return (
    <main className="min-h-dvh bg-[#FFFBF0] pb-[calc(3rem+env(safe-area-inset-bottom))] text-[#1E3A9E]">
      <div className="mx-auto w-full max-w-[480px] px-4">
        <Worldcup entrants={pickWorldcupEntrants(photos)} photos={photos} />

        <footer className="mt-14 flex flex-col items-center gap-4">
          <Link
            href="/records"
            className="inline-flex min-h-12 items-center rounded-full bg-[#1E3A9E] px-7 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(30,58,158,0.6)] transition-transform active:scale-[0.98]"
          >
            다인이 기록 보러가기 →
          </Link>
          <Link href="/" className="text-sm font-semibold opacity-70 underline-offset-4 hover:underline">
            ← 홈으로
          </Link>
        </footer>
      </div>
    </main>
  );
}
