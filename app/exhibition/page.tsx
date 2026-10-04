import type { Metadata } from "next";
import Link from "next/link";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";
import { selectExhibitionPhotos, type ExhibitionPhoto } from "@/lib/exhibition";
import { SITE_URL } from "@/lib/seo-metadata";
import { pickWorldcupEntrants } from "@/lib/worldcup";
import ExhibitionGallery from "./exhibition-gallery";
import Worldcup from "./worldcup";

export const revalidate = 300;

const TITLE = "다인이 사진 월드컵 | 생일 기념";
const DESCRIPTION = "둘 중 더 마음에 드는 사진을 골라주세요. No.3 김다인 선수 생일 기념 사진 월드컵과 온라인 전시.";
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
    const selfieFolderId = process.env.NEXT_PUBLIC_SELFIE_FOLDER_ID?.trim();
    const images = await fetchDriveGalleryImages(undefined, {
      excludeFolderIds: selfieFolderId ? [selfieFolderId] : [],
    });
    return selectExhibitionPhotos(images);
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

        <section aria-labelledby="exhibition-title" className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#1E3A9E]/15" aria-hidden />
            <h2 id="exhibition-title" className="text-lg font-extrabold">
              📸 전시 감상 · 다인이의 순간들
            </h2>
            <span className="h-px flex-1 bg-[#1E3A9E]/15" aria-hidden />
          </div>
          {photos.length > 0 ? (
            <ExhibitionGallery photos={photos} />
          ) : (
            <p className="rounded-3xl bg-white px-6 py-12 text-center font-bold shadow-[0_8px_24px_-14px_rgba(30,58,158,0.3)]">
              전시 준비 중입니다
            </p>
          )}
        </section>

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
